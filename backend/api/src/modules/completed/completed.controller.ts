import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request, Response } from "express";
import multer from "multer";

import { AuthGuard } from "../../common/auth/auth.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { RolesGuard } from "../../common/auth/roles.guard";
import { CompletedService } from "./completed.service";

@Controller("completed-processes")
@UseGuards(AuthGuard, RolesGuard)
@Roles("OPERADOR", "MASTER")
export class CompletedController {
  constructor(private readonly service: CompletedService) {}

  @Get()
  list(@Req() req: Request, @Query() query: Record<string, string>) { return this.service.list(req.actor!, query); }

  @Get("legacy-clients")
  legacyClients(@Req() req: Request, @Query("search") search?: string) { return this.service.listLegacyClients(req.actor!, search); }

  @Get("legacy-clients/:id")
  legacyClient(@Param("id") id: string, @Req() req: Request) { return this.service.getLegacyClient(id, req.actor!); }

  @Get(":id")
  get(@Param("id") id: string, @Req() req: Request) { return this.service.get(id, req.actor!); }

  @Post("legacy-clients")
  createLegacy(@Body() body: Record<string, unknown>, @Req() req: Request) { return this.service.createLegacyClient(body, req.actor!); }

  @Post("legacy-clients/:clientId/contracts/blank")
  legacyBlank(@Param("clientId") clientId: string, @Body() body: { title: string; type?: string }, @Req() req: Request) { return this.service.createLegacyBlank(clientId, body, req.actor!); }

  @Post("legacy-clients/:clientId/contracts/upload")
  @UseInterceptors(FileInterceptor("file", { storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }))
  legacyUpload(@Param("clientId") clientId: string, @UploadedFile() file: Express.Multer.File, @Body() body: { title?: string; type?: string }, @Req() req: Request) { return this.service.uploadLegacyContract(clientId, file, body, req.actor!); }

  @Post(":id/contracts/blank")
  blank(@Param("id") id: string, @Body() body: { title: string; type?: string }, @Req() req: Request) { return this.service.createBlank(id, body, req.actor!); }

  @Post(":id/contracts/upload")
  @UseInterceptors(FileInterceptor("file", { storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }))
  upload(@Param("id") id: string, @UploadedFile() file: Express.Multer.File, @Body() body: { title?: string; type?: string }, @Req() req: Request) {
    return this.service.uploadContract(id, file, body, req.actor!);
  }

  @Put("contracts/:contractId")
  update(@Param("contractId") id: string, @Body() body: { content: unknown; title?: string; expectedVersion?: number }, @Req() req: Request) { return this.service.updateContract(id, body, req.actor!); }

  @Post("contracts/:contractId/finalize")
  finalize(@Param("contractId") id: string, @Req() req: Request) { return this.service.finalizeContract(id, req.actor!); }

  @Post(":id/reopen")
  @Roles("MASTER")
  reopen(@Param("id") id: string, @Body() body: { reason: string; kanbanStage: string }, @Req() req: Request) { return this.service.reopen(id, body, req.actor!); }

  @Post("contracts/:contractId/export/:format")
  export(@Param("contractId") id: string, @Param("format") format: "pdf" | "docx", @Req() req: Request) { return this.service.exportContract(id, format, req.actor!); }

  @Get("contracts/:contractId/files/:fileId")
  async download(@Param("contractId") contractId: string, @Param("fileId") fileId: string, @Req() req: Request, @Res() res: Response) {
    const file = await this.service.getFile(contractId, fileId, req.actor!);
    res.setHeader("Content-Type", file.mimeType); res.setHeader("Content-Disposition", `attachment; filename="${file.fileName.replace(/[\\"\r\n]/g, "_")}"`); res.setHeader("Cache-Control", "private, no-store"); res.send(file.data);
  }

  @Get("contracts/:contractId/exports/:exportId")
  async downloadExport(@Param("contractId") contractId: string, @Param("exportId") exportId: string, @Req() req: Request, @Res() res: Response) {
    const file = await this.service.getExport(contractId, exportId, req.actor!);
    res.setHeader("Content-Type", file.mimeType); res.setHeader("Content-Disposition", `attachment; filename="${file.fileName.replace(/[\\"\r\n]/g, "_")}"`); res.setHeader("Cache-Control", "private, no-store"); res.send(file.data);
  }
}
