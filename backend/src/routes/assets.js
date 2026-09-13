const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { success, error, paginate } = require('../utils/response');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const blockchain = require('../services/blockchain');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map(v => v.run(req)));
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return error(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
};

async function callBlockchain(fn, fallbackHash) {
  try {
    const result = await fn();
    return result.hash || result.transactionHash || fallbackHash;
  } catch (e) {
    console.warn('Blockchain call skipped (no node):', e.message);
    return fallbackHash;
  }
}

/**
 * @route GET /api/v1/assets
 * @desc List assets
 */
router.get('/', requireAuth, requirePermission('asset.read'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.category) where.category = req.query.category;

    // Search
    if (req.query.search) {
      where.OR = [
        { assetCode: { contains: req.query.search, mode: 'insensitive' } },
        { name: { contains: req.query.search, mode: 'insensitive' } },
        { category: { contains: req.query.search, mode: 'insensitive' } }
      ];
    }

    // Scoped access: logic to restrict based on role
    if (!req.user.roles.includes('admin') && !req.user.roles.includes('auditor')) {
      if (req.user.roles.includes('manager')) {
        where.OR = [
          { managerScopes: { some: { managerUserId: req.user.id, revokedAt: null } } },
          { ownershipRecords: { some: { ownerUserId: req.user.id, isCurrent: true } } }
        ];
      } else {
        where.ownershipRecords = { some: { ownerUserId: req.user.id, isCurrent: true } };
      }
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        skip,
        take: limit,
        include: { 
          ownershipRecords: { 
            where: { isCurrent: true },
            include: {
              didRecord: { select: { did: true, user: { select: { name: true } } } },
              owner: { select: { name: true, email: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.asset.count({ where })
    ]);

    // Serialize BigInts
    const formattedAssets = assets.map(a => ({
      ...a,
      tokenId: a.tokenId ? a.tokenId.toString() : null,
      ownershipRecords: a.ownershipRecords.map(or => ({
        ...or,
        blockNumber: or.blockNumber ? or.blockNumber.toString() : null
      }))
    }));

    return paginate(res, formattedAssets, page, limit, total);
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/v1/assets
 * @desc Mint a new asset (supports file upload for physical/digital documents)
 */
router.post('/', requireAuth, requirePermission('asset.create'), upload.single('document'), validate([
  body('assetCode').notEmpty().withMessage('Asset code required'),
  body('name').notEmpty().withMessage('Name required'),
  body('category').notEmpty().withMessage('Category required'),
  body('ownerDid').optional().isString()
]), async (req, res, next) => {
  try {
    const { assetCode, name, category, description, location, metadata, ownerDid } = req.body;
    
    // 1. Validate uniqueness
    const existing = await prisma.asset.findUnique({ where: { assetCode } });
    if (existing) {
      if (req.file) fs.unlinkSync(req.file.path); // clean up
      return error(res, 'Asset code already exists', 409);
    }

    // 2. Validate target DID if provided
    let targetDid = 'PLATFORM';
    let targetUserId = null;
    if (ownerDid && ownerDid !== 'PLATFORM') {
      const dbDid = await prisma.did.findUnique({ where: { did: ownerDid } });
      if (!dbDid) {
        if (req.file) fs.unlinkSync(req.file.path); // clean up
        return error(res, 'Target DID not found', 404);
      }
      targetDid = dbDid.did;
      targetUserId = dbDid.userId;
    }

    // 2.5 Handle Document Upload (if any)
    let documentHash = null;
    let documentUrl = null;
    if (req.file) {
      // Calculate real SHA-256 hash of the uploaded file
      const fileBuffer = fs.readFileSync(req.file.path);
      documentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      documentUrl = `/uploads/${req.file.filename}`;
    }

    // 3. Prepare Metadata Hash
    const offchainData = { 
      assetCode, 
      name, 
      category, 
      description, 
      location, 
      metadata,
      ...(documentHash && { documentHash, documentUrl }) 
    };
    const metadataString = JSON.stringify(offchainData);
    const metadataHash = crypto.createHash('sha256').update(metadataString).digest('hex');
    const bytes32MetadataHash = '0x' + metadataHash;
    const tokenURIStr = `ipfs://decentravault/${assetCode}`;

    // 4. Mint on Blockchain (with fallback)
    let tokenId = BigInt(Date.now() % 1000000 + Math.floor(Math.random() * 1000));
    const fallbackHash = '0xmint_' + Math.random().toString(36).substr(2, 16);
    let txHash = fallbackHash;

    try {
      const mintResult = await blockchain.mintAsset(targetDid, bytes32MetadataHash, tokenURIStr);
      txHash = mintResult.hash || mintResult.transactionHash || fallbackHash;
      // Try to parse tokenId from logs
      if (mintResult.logs && mintResult.logs.length > 0) {
        try {
          const transferLog = mintResult.logs.find(l => l.topics && l.topics.length >= 4);
          if (transferLog) {
            tokenId = BigInt(transferLog.topics[3]);
          }
        } catch {}
      }
    } catch (blockchainError) {
      console.warn('Blockchain mint skipped (no node):', blockchainError.message);
    }

    // 5. Database transaction
    const result = await prisma.$transaction(async (txPrisma) => {
      const newAsset = await txPrisma.asset.create({
        data: {
          assetCode,
          name,
          category,
          description,
          location,
          status: targetDid === 'PLATFORM' ? 'minted' : 'assigned',
          tokenId,
          metadataHash: bytes32MetadataHash,
          mintTxHash: txHash,
          createdBy: req.user.id
        }
      });

      if (metadata && typeof metadata === 'object') {
        const metadataArray = Object.keys(metadata).map(k => ({
          assetId: newAsset.id,
          key: k,
          value: String(metadata[k])
        }));
        if (documentHash) {
          metadataArray.push({ assetId: newAsset.id, key: '_documentHash', value: documentHash });
          metadataArray.push({ assetId: newAsset.id, key: '_documentUrl', value: documentUrl });
        }
        if (metadataArray.length > 0) {
          await txPrisma.assetMetadata.createMany({ data: metadataArray });
        }
      } else if (documentHash) {
        await txPrisma.assetMetadata.createMany({
          data: [
            { assetId: newAsset.id, key: '_documentHash', value: documentHash },
            { assetId: newAsset.id, key: '_documentUrl', value: documentUrl }
          ]
        });
      }

      await txPrisma.ownershipRecord.create({
        data: {
          assetId: newAsset.id,
          ownerDid: targetDid === 'PLATFORM' ? 'PLATFORM' : targetDid,
          ownerUserId: targetUserId,
          action: 'mint',
          txHash,
          isCurrent: true
        }
      });

      const eventHash = crypto.createHash('sha256').update(`ASSET_MINTED:${assetCode}:${txHash}:${Date.now()}`).digest('hex');
      await txPrisma.auditEvent.create({
        data: {
          eventType: 'ASSET_MINTED',
          actorUserId: req.user.id,
          actorRole: req.user.roles[0] || 'admin',
          entityType: 'asset',
          entityId: newAsset.id,
          action: 'mint',
          payload: { assetCode, targetDid, category },
          txHash,
          eventHash
        }
      });

      // Notification
      await txPrisma.notification.create({
        data: {
          userId: req.user.id,
          type: 'asset_minted',
          title: 'Asset Minted',
          body: `Asset "${name}" (${assetCode}) has been minted successfully`,
          entityType: 'asset',
          entityId: newAsset.id
        }
      });

      return newAsset;
    });

    return success(res, {
      asset: { ...result, tokenId: result.tokenId ? result.tokenId.toString() : null },
      txHash
    }, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/v1/assets/:id/transfer
 * @desc Transfer asset ownership
 */
router.post('/:id/transfer', requireAuth, requirePermission('asset.transfer'), validate([
  body('toDid').notEmpty().withMessage('Target DID required')
]), async (req, res, next) => {
  try {
    const { toDid } = req.body;
    const assetId = req.params.id;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { ownershipRecords: { where: { isCurrent: true } } }
    });

    if (!asset) return error(res, 'Asset not found', 404);

    const currentOwnerRec = asset.ownershipRecords[0];
    const fromDid = currentOwnerRec ? currentOwnerRec.ownerDid : 'PLATFORM';

    const targetDidRecord = await prisma.did.findUnique({ where: { did: toDid } });
    if (!targetDidRecord) return error(res, 'Target DID not found', 404);

    // Blockchain transfer (with fallback)
    const fallbackHash = '0xtransfer_' + Math.random().toString(36).substr(2, 16);
    let txHash = fallbackHash;

    if (asset.tokenId) {
      try {
        const transferResult = await blockchain.platformTransfer(asset.tokenId, fromDid, toDid);
        txHash = transferResult.hash || transferResult.transactionHash || fallbackHash;
      } catch (e) {
        console.warn('Blockchain transfer skipped (no node):', e.message);
      }
    }

    await prisma.$transaction(async (txPrisma) => {
      if (currentOwnerRec) {
        await txPrisma.ownershipRecord.update({
          where: { id: currentOwnerRec.id },
          data: { isCurrent: false }
        });
      }

      await txPrisma.ownershipRecord.create({
        data: {
          assetId: asset.id,
          ownerDid: toDid,
          ownerUserId: targetDidRecord.userId,
          fromDid,
          fromUserId: currentOwnerRec ? currentOwnerRec.ownerUserId : null,
          action: 'transfer',
          txHash,
          isCurrent: true
        }
      });

      await txPrisma.asset.update({
        where: { id: asset.id },
        data: { status: 'assigned' }
      });

      const eventHash = crypto.createHash('sha256').update(`ASSET_TRANSFERRED:${asset.assetCode}:${txHash}:${Date.now()}`).digest('hex');
      await txPrisma.auditEvent.create({
        data: {
          eventType: 'ASSET_TRANSFERRED',
          actorUserId: req.user.id,
          actorRole: req.user.roles[0] || 'admin',
          entityType: 'asset',
          entityId: asset.id,
          action: 'transfer',
          payload: { fromDid, toDid, assetCode: asset.assetCode },
          txHash,
          eventHash
        }
      });

      // Notification for both parties
      await txPrisma.notification.create({
        data: {
          userId: targetDidRecord.userId,
          type: 'asset_transferred',
          title: 'Asset Transfer Received',
          body: `You received ownership of "${asset.name}" (${asset.assetCode})`,
          entityType: 'asset',
          entityId: asset.id
        }
      });
    });

    return success(res, { message: 'Transfer completed', txHash });
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/v1/assets/access-requests/pending
 * @desc Get all pending access requests (Admin/Manager)
 */
router.get('/access-requests/pending', requireAuth, async (req, res, next) => {
  try {
    if (!req.user.roles.includes('admin') && !req.user.roles.includes('manager')) {
      return error(res, 'Access denied', 403);
    }
    const requests = await prisma.accessRequest.findMany({
      where: { status: 'pending' },
      include: {
        user: { select: { name: true, email: true } },
        asset: { select: { assetCode: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return success(res, requests);
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/v1/assets/access-requests/:reqId/approve
 * @desc Approve an access request
 */
router.post('/access-requests/:reqId/approve', requireAuth, async (req, res, next) => {
  try {
    if (!req.user.roles.includes('admin') && !req.user.roles.includes('manager')) {
      return error(res, 'Access denied', 403);
    }
    const accessReq = await prisma.accessRequest.findUnique({
      where: { id: req.params.reqId },
      include: { asset: true }
    });
    if (!accessReq) return error(res, 'Request not found', 404);
    if (accessReq.status !== 'pending') return error(res, 'Request is not pending', 400);

    await prisma.assetPermission.upsert({
      where: {
        userId_assetId_permission: {
          userId: accessReq.userId,
          assetId: accessReq.assetId,
          permission: 'ASSET_VIEW'
        }
      },
      update: {},
      create: {
        userId: accessReq.userId,
        assetId: accessReq.assetId,
        permission: 'ASSET_VIEW',
        grantedBy: req.user.id
      }
    });

    await prisma.accessRequest.update({
      where: { id: accessReq.id },
      data: { status: 'approved' }
    });

    await prisma.notification.create({
      data: {
        userId: accessReq.userId,
        type: 'access_approved',
        title: 'Document Access Approved',
        body: `Your request to view the document for ${accessReq.asset.name} has been approved.`,
        entityType: 'asset',
        entityId: accessReq.assetId
      }
    });

    return success(res, { message: 'Access request approved' });
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/v1/assets/access-requests/:reqId/reject
 * @desc Reject an access request
 */
router.post('/access-requests/:reqId/reject', requireAuth, async (req, res, next) => {
  try {
    if (!req.user.roles.includes('admin') && !req.user.roles.includes('manager')) {
      return error(res, 'Access denied', 403);
    }
    const accessReq = await prisma.accessRequest.findUnique({
      where: { id: req.params.reqId },
      include: { asset: true }
    });
    if (!accessReq) return error(res, 'Request not found', 404);
    if (accessReq.status !== 'pending') return error(res, 'Request is not pending', 400);

    await prisma.accessRequest.update({
      where: { id: accessReq.id },
      data: { status: 'rejected' }
    });

    await prisma.notification.create({
      data: {
        userId: accessReq.userId,
        type: 'access_rejected',
        title: 'Document Access Rejected',
        body: `Your request to view the document for ${accessReq.asset.name} was rejected.`,
        entityType: 'asset',
        entityId: accessReq.assetId
      }
    });

    return success(res, { message: 'Access request rejected' });
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/v1/assets/:id/request-access
 * @desc Request access to view an asset document
 */
router.post('/:id/request-access', requireAuth, async (req, res, next) => {
  try {
    const assetId = req.params.id;
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return error(res, 'Asset not found', 404);

    const existingReq = await prisma.accessRequest.findUnique({
      where: { userId_assetId: { userId: req.user.id, assetId } }
    });

    if (existingReq && existingReq.status === 'pending') {
      return error(res, 'Access request already pending', 400);
    }

    await prisma.accessRequest.upsert({
      where: { userId_assetId: { userId: req.user.id, assetId } },
      update: { status: 'pending' },
      create: { userId: req.user.id, assetId, status: 'pending' }
    });

    const admins = await prisma.user.findMany({
      where: { userRoles: { some: { role: { name: 'admin' } } } }
    });
    
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(a => ({
          userId: a.id,
          type: 'access_request',
          title: 'New Document Access Request',
          body: `${req.user.name} has requested access to view ${asset.name}.`,
          entityType: 'asset',
          entityId: asset.id
        }))
      });
    }

    return success(res, { message: 'Access request submitted successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/v1/assets/:id
 * @desc Get asset details
 */
router.get('/:id', requireAuth, requirePermission('asset.read'), async (req, res, next) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
      include: {
        metadata: true,
        creator: { select: { name: true, email: true } },
        ownershipRecords: {
          orderBy: { transferredAt: 'desc' },
          include: { 
            didRecord: { select: { did: true, user: { select: { name: true } } } },
            fromUser: { select: { name: true } },
            owner: { select: { name: true, email: true } }
          }
        }
      }
    });

    if (!asset) return error(res, 'Asset not found', 404);

    return success(res, {
      ...asset,
      tokenId: asset.tokenId ? asset.tokenId.toString() : null,
      ownershipRecords: asset.ownershipRecords.map(or => ({
        ...or,
        blockNumber: or.blockNumber ? or.blockNumber.toString() : null
      }))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/v1/assets/:id/view
 * @desc Securely view the document attached to an asset
 */
router.get('/:id/view', requireAuth, async (req, res, next) => {
  try {
    const assetId = req.params.id;

    // Load asset with metadata to find document
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        metadata: true
      }
    });

    if (!asset) {
      return error(res, 'Asset not found', 404);
    }

    // Check Authorization
    let isAuthorized = false;
    
    // 1. Admins can view all
    if (req.user.roles.includes('admin')) {
      isAuthorized = true;
    }

    // 2. Managers with scope over this asset
    if (!isAuthorized && req.user.roles.includes('manager')) {
      const scope = await prisma.managerAssetScope.findFirst({
        where: {
          managerUserId: req.user.id,
          OR: [
            { isGlobal: true },
            { assetId: assetId },
            { assetCategory: asset.category }
          ]
        }
      });
      if (scope) isAuthorized = true;
    }

    // 3. User with explicit ASSET_VIEW permission for this specific asset
    if (!isAuthorized) {
      const perm = await prisma.assetPermission.findUnique({
        where: {
          userId_assetId_permission: {
            userId: req.user.id,
            assetId: assetId,
            permission: 'ASSET_VIEW'
          }
        }
      });
      if (perm) isAuthorized = true;
    }

    // Audit unauthorized attempt
    if (!isAuthorized) {
      await prisma.auditEvent.create({
        data: {
          eventType: 'asset.view_denied',
          severity: 'warning',
          actorUserId: req.user.id,
          entityType: 'asset',
          entityId: asset.id,
          action: 'view_document',
          payload: { reason: 'Missing ASSET_VIEW permission' },
          status: 'failed',
          eventHash: crypto.randomBytes(32).toString('hex')
        }
      });
      return error(res, 'Access denied: Missing ASSET_VIEW permission for this asset', 403);
    }

    const docUrlMeta = asset.metadata.find(m => m.key === '_documentUrl');
    const docHashMeta = asset.metadata.find(m => m.key === '_documentHash');

    if (!docUrlMeta || !docUrlMeta.value) {
      return error(res, 'No document attached to this asset', 404);
    }

    // Determine absolute path
    const filePath = path.join(__dirname, '../../', docUrlMeta.value);
    
    if (!fs.existsSync(filePath)) {
      return error(res, 'Document file not found on server', 404);
    }

    // Integrity Verification (compare on-the-fly hash to stored hash)
    const fileBuffer = fs.readFileSync(filePath);
    const currentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const isIntegrityVerified = (currentHash === docHashMeta?.value);

    // Audit successful view
    await prisma.auditEvent.create({
      data: {
        eventType: 'asset.viewed',
        severity: 'info',
        actorUserId: req.user.id,
        entityType: 'asset',
        entityId: asset.id,
        action: 'view_document',
        payload: { 
          documentHash: currentHash,
          integrityVerified: isIntegrityVerified
        },
        status: 'success',
        eventHash: crypto.randomBytes(32).toString('hex')
      }
    });

    res.setHeader('Access-Control-Expose-Headers', 'X-Document-Integrity');
    res.setHeader('X-Document-Integrity', isIntegrityVerified ? 'verified' : 'failed');
    return res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/v1/assets/:id/permissions
 * @desc Grant or revoke an asset-specific permission for a user
 */
router.post('/:id/permissions', requireAuth, validate([
  body('targetUserId').isUUID().withMessage('targetUserId must be a valid UUID'),
  body('permission').isString().notEmpty().withMessage('permission is required'),
  body('action').isIn(['grant', 'revoke']).withMessage('action must be grant or revoke')
]), async (req, res, next) => {
  try {
    const assetId = req.params.id;
    const { targetUserId, permission, action } = req.body;

    // Only Admin or Manager can modify permissions
    if (!req.user.roles.includes('admin') && !req.user.roles.includes('manager')) {
      return error(res, 'Access denied', 403);
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return error(res, 'Asset not found', 404);

    if (action === 'grant') {
      await prisma.assetPermission.upsert({
        where: {
          userId_assetId_permission: {
            userId: targetUserId,
            assetId: assetId,
            permission: permission
          }
        },
        update: {},
        create: {
          userId: targetUserId,
          assetId: assetId,
          permission: permission,
          grantedBy: req.user.id
        }
      });
    } else {
      await prisma.assetPermission.deleteMany({
        where: {
          userId: targetUserId,
          assetId: assetId,
          permission: permission
        }
      });
    }

    await prisma.auditEvent.create({
      data: {
        eventType: 'asset.permission_changed',
        severity: 'info',
        actorUserId: req.user.id,
        entityType: 'asset',
        entityId: asset.id,
        action: `${action}_permission`,
        payload: { targetUserId, permission },
        status: 'success',
        eventHash: crypto.randomBytes(32).toString('hex')
      }
    });

    return success(res, { message: `Permission ${action}ed successfully` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
