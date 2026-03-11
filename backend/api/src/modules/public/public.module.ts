import { Module } from "@nestjs/common";
import { PublicController, RootController } from "./public.controller";
import { PublicService } from "./public.service";

@Module({
  controllers: [RootController, PublicController],
  providers: [PublicService]
})
export class PublicModule {}
