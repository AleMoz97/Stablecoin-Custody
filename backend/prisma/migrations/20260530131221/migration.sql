-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('MINT', 'BURN', 'FREEZE');

-- CreateEnum
CREATE TYPE "MultisigKind" AS ENUM ('MINT_BURN', 'ADMIN');

-- CreateTable
CREATE TABLE "ApiTxMapping" (
    "id" TEXT NOT NULL,
    "operationType" "OperationType" NOT NULL,
    "multisigKind" "MultisigKind" NOT NULL,
    "multisigTxId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiTxMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainEvent" (
    "id" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiTxMapping_multisigKind_multisigTxId_key" ON "ApiTxMapping"("multisigKind", "multisigTxId");

-- CreateIndex
CREATE UNIQUE INDEX "ChainEvent_txHash_logIndex_key" ON "ChainEvent"("txHash", "logIndex");
