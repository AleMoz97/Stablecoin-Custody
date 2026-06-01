import { Injectable } from "@nestjs/common";
import { BlockchainService } from "../blockchain/blockchain.service.js";
import { MintRequestDto } from "./dto/mint-request.dto.js";
import { BurnRequestDto } from "./dto/burn-request.dto.js";
import { FreezeRequestDto } from "./dto/freeze-request.dto.js";
import { OperationSummaryResponseDto } from "./dto/operation-summary-response.dto.js";
import { TransactionStatusResponseDto } from "./dto/transaction-status-response.dto.js";
import { BalanceResponseDto } from "./dto/balance-response.dto.js";

@Injectable()
export class StablecoinService {
    constructor(private readonly blockchainService: BlockchainService) {}

    handleMintRequest(dto: MintRequestDto): Promise<OperationSummaryResponseDto> {
        return this.blockchainService.handleMintRequest(dto);
    }

    handleBurnRequest(dto: BurnRequestDto): Promise<OperationSummaryResponseDto> {
        return this.blockchainService.handleBurnRequest(dto);
    }

    handleFreezeRequest(dto: FreezeRequestDto): Promise<OperationSummaryResponseDto> {
        return this.blockchainService.handleFreezeRequest(dto);
    }

    getStatus(txId: string): Promise<TransactionStatusResponseDto> {
        return this.blockchainService.getStatus(txId);
    }

    getBalance(address: string): Promise<BalanceResponseDto> {
        return this.blockchainService.getBalance(address);
    }
}
