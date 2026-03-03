import { Module } from "@nestjs/common";
import { PublicController, RootController } from "./public.controller";
import { PublicService } from "./public.service";
import { PrismaService } from "../../shared/prisma.service";

@Module({
  controllers: [RootController, PublicController],
  providers: [PublicService, PrismaService]
})
export class PublicModule {}
