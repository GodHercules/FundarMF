import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";

export interface StoredFileInput {
  itemId: string;
  fileName: string;
  mimeType: string;
  size: number;
  data: Buffer;
  uploadedByRole: "CLIENTE" | "FUNCIONARIO" | "MASTER" | "SYSTEM";
  uploadedById?: string;
}

@Injectable()
export class StorageService {
  constructor(private readonly prisma: PrismaService) {}

  async deleteFilesByItem(itemId: string) {
    await this.prisma.documentFile.deleteMany({ where: { itemId } });
  }

  async saveFile(input: StoredFileInput) {
    return this.prisma.documentFile.create({
      data: {
        itemId: input.itemId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size,
        data: input.data,
        uploadedByRole: input.uploadedByRole,
        uploadedById: input.uploadedById
      }
    });
  }

  async getFile(fileId: string) {
    return this.prisma.documentFile.findUnique({ where: { id: fileId } });
  }
}
