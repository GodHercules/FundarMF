import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service";
import { PrismaService } from "../../shared/prisma.service";

@Module({
  providers: [StorageService, PrismaService],
  exports: [StorageService]
})
export class StorageModule {}
