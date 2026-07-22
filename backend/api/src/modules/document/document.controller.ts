import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { DocumentItemKey } from "@prisma/client";
import { Request, Response } from "express";
import multer from "multer";

import { AuthGuard } from "../../common/auth/auth.guard";
import { RolesGuard } from "../../common/auth/roles.guard";
import { DocumentService } from "./document.service";
import { ValidateItemDto } from "./dto/validate-item.dto";

@Controller("documents")
@UseGuards(AuthGuard, RolesGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post(":processId/items/:itemKey/upload")
  @UseInterceptors(
    FilesInterceptor("files", 12, {
      storage: multer.memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024, files: 12 }
    })
  )
  async upload(
    @Param("processId") processId: string,
    @Param("itemKey") itemKey: DocumentItemKey,
    @Query("socioId") socioId: string | undefined,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request
  ) {
    return this.documentService.uploadFiles(processId, itemKey, socioId, files, req.actor!);
  }

  @Post(":processId/items/:itemKey/validate")
  async validate(
    @Param("processId") processId: string,
    @Param("itemKey") itemKey: DocumentItemKey,
    @Body() dto: ValidateItemDto,
    @Req() req: Request
  ) {
    return this.documentService.validateItem(processId, itemKey, dto.socioId, dto.status, dto.reason, req.actor!);
  }

  @Get(":processId/items")
  async listItems(@Param("processId") processId: string, @Req() req: Request) {
    return this.documentService.listItems(processId, req.actor!);
  }

  @Get(":processId/items/:itemKey/preview/:fileId")
  async preview(
    @Param("processId") processId: string,
    @Param("itemKey") itemKey: DocumentItemKey,
    @Param("fileId") fileId: string,
    @Res() res: Response,
    @Req() req: Request
  ) {
    const file = await this.documentService.getFile(processId, itemKey, fileId, req.actor!, "preview_document");
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `inline; filename="${this.safeFileName(file.fileName)}"`);
    res.send(file.data);
  }

  @Get(":processId/items/:itemKey/download/:fileId")
  async download(
    @Param("processId") processId: string,
    @Param("itemKey") itemKey: DocumentItemKey,
    @Param("fileId") fileId: string,
    @Res() res: Response,
    @Req() req: Request
  ) {
    const file = await this.documentService.getFile(processId, itemKey, fileId, req.actor!, "download_document");
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename="${this.safeFileName(file.fileName)}"`);
    res.send(file.data);
  }

  private safeFileName(fileName: string) {
    const safe = [...fileName].map((character) => {
      const code = character.charCodeAt(0);
      return character === '"' || character === "\\" || code <= 31 || code === 127 ? "_" : character;
    });
    return safe.join("").slice(0, 180) || "document";
  }
}
