import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { Response } from "express";
import { FilesInterceptor } from "@nestjs/platform-express";
import multer from "multer";
import { DocumentService } from "./document.service";
import { AuthGuard } from "../../common/auth/auth.guard";
import { RolesGuard } from "../../common/auth/roles.guard";
import { ValidateItemDto } from "./dto/validate-item.dto";
import { Req } from "@nestjs/common";

@Controller("documents")
@UseGuards(AuthGuard, RolesGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post(":processId/items/:itemKey/upload")
  @UseInterceptors(FilesInterceptor("files", 12, { storage: multer.memoryStorage() }))
  async upload(
    @Param("processId") processId: string,
    @Param("itemKey") itemKey: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Res({ passthrough: true }) res: Response,
    @Req() req: any
  ) {
    return this.documentService.uploadFiles(processId, itemKey, files, req.actor!);
  }

  @Post(":processId/items/:itemKey/validate")
  async validate(
    @Param("processId") processId: string,
    @Param("itemKey") itemKey: any,
    @Body() dto: ValidateItemDto,
    @Req() req: any
  ) {
    return this.documentService.validateItem(processId, itemKey, dto.status, dto.reason, req.actor!);
  }

  @Get(":processId/items/:itemKey/preview/:fileId")
  async preview(
    @Param("processId") processId: string,
    @Param("itemKey") itemKey: any,
    @Param("fileId") fileId: string,
    @Res() res: Response,
    @Req() req: any
  ) {
    const file = await this.documentService.getFile(processId, itemKey, fileId, req.actor!, "preview_document");
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename=\"${file.fileName}\"`);
    res.send(file.data);
  }

  @Get(":processId/items/:itemKey/download/:fileId")
  async download(
    @Param("processId") processId: string,
    @Param("itemKey") itemKey: any,
    @Param("fileId") fileId: string,
    @Res() res: Response,
    @Req() req: any
  ) {
    const file = await this.documentService.getFile(processId, itemKey, fileId, req.actor!, "download_document");
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename=\"${file.fileName}\"`);
    res.send(file.data);
  }
}
