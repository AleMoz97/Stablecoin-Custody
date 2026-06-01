import { Module } from "@nestjs/common";
import { BlockchainModule } from "../blockchain/blockchain.module.js";
import { StablecoinController } from "./stablecoin.controller.js";
import { StablecoinService } from "./stablecoin.service.js";

@Module({
    imports: [BlockchainModule],
    controllers: [StablecoinController],
    providers: [StablecoinService],
})
export class StablecoinModule {}
