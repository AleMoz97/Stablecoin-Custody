import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BlockchainService } from "./blockchain.service.js";
import { EventListenerService } from "./event-listener.service.js";

@Module({
    imports: [ConfigModule],
    providers: [BlockchainService, EventListenerService],
    exports: [BlockchainService],
})
export class BlockchainModule {}
