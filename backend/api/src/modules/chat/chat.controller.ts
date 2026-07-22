import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { Request } from "express";

import { AuthGuard } from "../../common/auth/auth.guard";
import { RolesGuard } from "../../common/auth/roles.guard";
import { ChatService } from "./chat.service";

class MessageDto {
  @IsString()
  @MinLength(1)
  body: string;
}

@Controller("chats")
@UseGuards(AuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(":processId")
  async list(@Param("processId") processId: string, @Req() req: Request) {
    return this.chatService.listMessages(processId, req.actor!);
  }

  @Post(":processId/messages")
  async add(@Param("processId") processId: string, @Body() dto: MessageDto, @Req() req: Request) {
    return this.chatService.addMessage(processId, req.actor!, dto.body);
  }
}
