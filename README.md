# SurakshaVault - Asset Management Software

SurakshaVault is a highly secure, blockchain-backed Asset and Identity Management system designed to track physical and digital assets across their entire lifecycle. By combining a traditional relational database (PostgreSQL) with a decentralized blockchain layer, the system guarantees data immutability, cryptographically verifiable audit trails, and strict role-based access control.

## 🏗️ Technology Stack

**Frontend:**
- React.js with Vite
- CSS (Vanilla, custom UI framework)
- Lucide React (Icons)
- Ethers.js (Blockchain interaction)

**Backend:**
- Node.js & Express.js
- Prisma ORM
- PostgreSQL (Neon Database)
- Ethers.js (Blockchain indexing/polling)
- JSON Web Tokens (JWT) for authentication

**Blockchain:**
- Polygon (EVM compatible)
- Solidity Smart Contracts (AssetRegistry & DIDRegistry)
- Decentralized Identifiers (DIDs)

---

## ⚙️ Core Architecture & Tech Flow

The architecture operates on a **hybrid ledger model**.
1. **Off-Chain (Database):** Fast, scalable storage for rich metadata (user profiles, asset descriptions, full audit logs).
2. **On-Chain (Blockchain):** Immutable, public proof of state (ownership transfers, decentralized identity registry, metadata hashes).

When an action occurs (e.g., Minting an Asset), the backend creates a transaction on the blockchain containing a SHA-256 hash of the asset data. Once confirmed on-chain, the transaction hash is saved back into the PostgreSQL database, inextricably linking the fast database records with the immutable blockchain state.

---

## 🔄 System Workflows

### 1. Identity & Role Management (RBAC)
The system uses Decentralized Identifiers (DIDs) combined with strict Role-Based Access Control (RBAC).

- **Identity Registration:** When an Admin registers a new user, a unique DID and cryptographic Private Key are generated. A smart contract transaction is fired to the `DIDRegistry` contract to log the identity on-chain.
- **Roles:** Users can have multiple roles assigned (`admin`, `manager`, `auditor`, `user`).
- **Role Auditing:** When an Admin assigns or revokes a role, the system generates a secure SHA-256 hash of the event and permanently logs it into the `AuditEvent` table.

### 2. Asset Lifecycle Management
Assets are tracked from creation to revocation.

- **Minting (Creation):** 
  - A user inputs asset details (e.g., Asset Code, Category, Description).
  - The backend generates a SHA-256 hash of the metadata.
  - A blockchain transaction is initiated to mint an NFT (Non-Fungible Token) representing the asset on the `AssetRegistry` smart contract.
  - The transaction hash and token ID are saved in the Postgres database alongside the rich metadata.
- **Viewing Details:** The frontend merges off-chain metadata (from Postgres) and on-chain proofs (transaction hashes, blockchain explorer links) into a unified detailed view.

### 3. Asset Transfer & Ownership Tracking
Assets can be transferred securely between users.

- **Transfer Flow:**
  - A user initiates a transfer to another user's DID.
  - A blockchain transaction securely transfers the underlying NFT to the new owner's address.
  - The PostgreSQL `OwnershipRecord` table is updated to reflect the new owner, keeping a historical log of all past owners.
- **Dual-State Sync:** A backend poller constantly listens to the blockchain to ensure the PostgreSQL database stays in perfect sync with the blockchain state.

### 4. Cryptographic Audit Logging
SurakshaVault ensures complete transparency and accountability through immutable audit logs.

- **Log Generation:** Every critical action (Identity Creation, Role Assignment/Revocation, Asset Minting, Asset Transfer, Logins) triggers the creation of an `AuditEvent`.
- **Cryptographic Chaining:** Each event generates an `eventHash` based on its payload, timestamp, and action.
- **Integrity Verification:** Auditors can click a "Verify Chain" button. The backend iterates through the entire audit log, recalculating the SHA-256 hashes to detect if any database records were tampered with or silently altered by malicious actors.

---

## 🛡️ Security Features
- **Data Tamper Evidence:** Any modification to the Postgres database directly invalidates the cryptographic hashes linked to the blockchain.
- **Stateless Authentication:** Secure JWT-based sessions.
- **Secure Key Management:** Identities are tied to cryptographic keypairs.

---

## 🚀 Running the Application

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database
- Polygon RPC URL and Private Key (for the backend wallet)

### Backend Setup
1. Navigate to the `backend/` directory.
2. Install dependencies: `npm install`
3. Configure your `.env` file with `DATABASE_URL`, `JWT_SECRET`, and Blockchain RPC credentials.
4. Run migrations: `npx prisma migrate dev`
5. Start the server: `npm run dev`

### Frontend Setup
1. Navigate to the `frontend/` directory.
2. Install dependencies: `npm install`
3. Configure your `.env` file with `VITE_API_URL` pointing to the backend.
4. Start the dev server: `npm run dev`
