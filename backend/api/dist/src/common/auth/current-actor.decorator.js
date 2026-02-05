"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentActor = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentActor = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.actor;
});
//# sourceMappingURL=current-actor.decorator.js.map