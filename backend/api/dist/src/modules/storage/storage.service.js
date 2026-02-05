"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../shared/prisma.service");
let StorageService = class StorageService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async deleteFilesByItem(itemId) {
        await this.prisma.documentFile.deleteMany({ where: { itemId } });
    }
    async saveFile(input) {
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
    async getFile(fileId) {
        return this.prisma.documentFile.findUnique({ where: { id: fileId } });
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StorageService);
//# sourceMappingURL=storage.service.js.map