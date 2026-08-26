/*
  Warnings:

  - Added the required column `updatedAt` to the `Attachment` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "uploadId" TEXT NOT NULL,
    "uploadStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "totalChunks" INTEGER NOT NULL DEFAULT 0,
    "receivedChunks" INTEGER NOT NULL DEFAULT 0,
    "uploadedBytes" BIGINT NOT NULL DEFAULT 0,
    "chunkDirectory" TEXT,
    "fileHash" TEXT,
    "thumbnailKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("chunkDirectory", "completedAt", "createdAt", "deletedAt", "duration", "fileHash", "height", "id", "messageId", "mimeType", "originalFileName", "receivedChunks", "size", "storageKey", "storedFileName", "thumbnailKey", "totalChunks", "type", "uploadId", "uploadStatus", "uploadedBytes", "uploaderId", "width") SELECT "chunkDirectory", "completedAt", "createdAt", "deletedAt", "duration", "fileHash", "height", "id", "messageId", "mimeType", "originalFileName", "receivedChunks", "size", "storageKey", "storedFileName", "thumbnailKey", "totalChunks", "type", "uploadId", "uploadStatus", "uploadedBytes", "uploaderId", "width" FROM "Attachment";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE UNIQUE INDEX "Attachment_uploadId_key" ON "Attachment"("uploadId");
CREATE INDEX "Attachment_messageId_idx" ON "Attachment"("messageId");
CREATE INDEX "Attachment_uploaderId_idx" ON "Attachment"("uploaderId");
CREATE INDEX "Attachment_uploadStatus_idx" ON "Attachment"("uploadStatus");
CREATE INDEX "Attachment_createdAt_idx" ON "Attachment"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
