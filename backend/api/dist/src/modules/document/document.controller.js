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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = __importDefault(require("multer"));
const document_service_1 = require("./document.service");
const auth_guard_1 = require("../../common/auth/auth.guard");
const roles_guard_1 = require("../../common/auth/roles.guard");
const validate_item_dto_1 = require("./dto/validate-item.dto");
const common_2 = require("@nestjs/common");
let DocumentController = class DocumentController {
    documentService;
    constructor(documentService) {
        this.documentService = documentService;
    }
    async upload(processId, itemKey, socioId, files, res, req) {
        return this.documentService.uploadFiles(processId, itemKey, socioId, files, req.actor);
    }
    async validate(processId, itemKey, dto, req) {
        return this.documentService.validateItem(processId, itemKey, dto.socioId, dto.status, dto.reason, req.actor);
    }
    async listItems(processId, req) {
        return this.documentService.listItems(processId, req.actor);
    }
    async preview(processId, itemKey, fileId, res, req) {
        const file = await this.documentService.getFile(processId, itemKey, fileId, req.actor, "preview_document");
        res.setHeader("Content-Type", file.mimeType);
        res.setHeader("Content-Disposition", `inline; filename=\"${file.fileName}\"`);
        res.send(file.data);
    }
    async download(processId, itemKey, fileId, res, req) {
        const file = await this.documentService.getFile(processId, itemKey, fileId, req.actor, "download_document");
        res.setHeader("Content-Type", file.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename=\"${file.fileName}\"`);
        res.send(file.data);
    }
};
exports.DocumentController = DocumentController;
__decorate([
    (0, common_1.Post)(":processId/items/:itemKey/upload"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)("files", 12, { storage: multer_1.default.memoryStorage() })),
    __param(0, (0, common_1.Param)("processId")),
    __param(1, (0, common_1.Param)("itemKey")),
    __param(2, (0, common_1.Query)("socioId")),
    __param(3, (0, common_1.UploadedFiles)()),
    __param(4, (0, common_1.Res)({ passthrough: true })),
    __param(5, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Array, Object, Object]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)(":processId/items/:itemKey/validate"),
    __param(0, (0, common_1.Param)("processId")),
    __param(1, (0, common_1.Param)("itemKey")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, validate_item_dto_1.ValidateItemDto, Object]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "validate", null);
__decorate([
    (0, common_1.Get)(":processId/items"),
    __param(0, (0, common_1.Param)("processId")),
    __param(1, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "listItems", null);
__decorate([
    (0, common_1.Get)(":processId/items/:itemKey/preview/:fileId"),
    __param(0, (0, common_1.Param)("processId")),
    __param(1, (0, common_1.Param)("itemKey")),
    __param(2, (0, common_1.Param)("fileId")),
    __param(3, (0, common_1.Res)()),
    __param(4, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, Object, Object]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "preview", null);
__decorate([
    (0, common_1.Get)(":processId/items/:itemKey/download/:fileId"),
    __param(0, (0, common_1.Param)("processId")),
    __param(1, (0, common_1.Param)("itemKey")),
    __param(2, (0, common_1.Param)("fileId")),
    __param(3, (0, common_1.Res)()),
    __param(4, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, Object, Object]),
    __metadata("design:returntype", Promise)
], DocumentController.prototype, "download", null);
exports.DocumentController = DocumentController = __decorate([
    (0, common_1.Controller)("documents"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [document_service_1.DocumentService])
], DocumentController);
//# sourceMappingURL=document.controller.js.map