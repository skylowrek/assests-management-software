const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function createAdmin() {
  const address = '0x7dCfab7209B4bCCbcbc00d3fa87798d28E0B76Ab';
  const did = 'did:ethr:11155111:0x7dCfab7209B4bCCbcbc00d3fa87798d28E0B76Ab';

  // 1. Check if user already exists
  let user = await prisma.user.findFirst({
    where: { email: 'admin@decentravault.com' }
  });

  if (!user) {
    console.log("Admin user not found. Run seed script first.");
    return;
  }

  // 2. Add DID to user
  const newDid = await prisma.did.create({
    data: { 
      userId: user.id, 
      did, 
      address, 
      publicKey: '0x', 
      chainId: 11155111, 
      onChainTx: 'manual_seed' 
    }
  });

  const didDoc = JSON.stringify({ "@context": "https://w3id.org/did/v1", "id": did });
  await prisma.didDocument.create({
    data: { didId: newDid.id, document: didDoc }
  });

  console.log("Successfully registered Admin DID:");
  console.log("DID:", did);
}

createAdmin().catch(console.error).finally(() => prisma.$disconnect());
