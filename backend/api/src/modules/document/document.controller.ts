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
import { DocumentItemKey } from "@prisma/client";
import { Request, Response } from "express";
import { FilesInterceptor } from "@nestjs/platform-express";
import multer from "multer";
import { DocumentService } from "./document.service";
import { AuthGuard } from "../../common/auth/auth.guard";
import { RolesGuard } from "../../common/auth/roles.guard";
import { ValidateItemDto } from "./dto/validate-item.dto";

@Controller("documents")
@UseGuards(AuthGuard, RolesGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post(":processId/items/:itemKey/upload")
  @UseInterceptors(FilesInterceptor("files", 12, { storage: multer.memoryStorage() }))
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
    res.setHeader("Content-Disposition", `inline; filename="${file.fileName}"`);
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
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    res.send(file.data);
  }
}
