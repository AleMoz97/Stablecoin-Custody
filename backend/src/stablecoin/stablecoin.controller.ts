import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
    ApiBadRequestResponse,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
} from "@nestjs/swagger";
import { StablecoinService } from "./stablecoin.service.js";
import { MintRequestDto } from "./dto/mint-request.dto.js";
import { BurnRequestDto } from "./dto/burn-request.dto.js";
import { FreezeRequestDto } from "./dto/freeze-request.dto.js";
import { OperationSummaryResponseDto } from "./dto/operation-summary-response.dto.js";
import { TransactionStatusResponseDto } from "./dto/transaction-status-response.dto.js";
import { BalanceResponseDto } from "./dto/balance-response.dto.js";
import { ErrorResponseDto } from "./dto/error-response.dto.js";

@Controller()
@ApiTags("stablecoin")
@ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: "Invalid input or invalid transaction action.",
})
@ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: "The request is valid but blocked by a business rule, such as failed KYC.",
})
@ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: "The requested API transaction was not found.",
})
@ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    description: "Unexpected backend or blockchain processing error.",
})
export class StablecoinController {
    constructor(private readonly stablecoinService: StablecoinService) { }

    @Post("mint-request")
    @ApiOperation({ summary: "Create or confirm a mint multisig request" })
    @ApiOkResponse({ type: OperationSummaryResponseDto })
    mintRequest(@Body() dto: MintRequestDto): Promise<OperationSummaryResponseDto> {
        return this.stablecoinService.handleMintRequest(dto);
    }

    @Post("burn-request")
    @ApiOperation({ summary: "Create or confirm a burn multisig request" })
    @ApiOkResponse({ type: OperationSummaryResponseDto })
    burnRequest(@Body() dto: BurnRequestDto): Promise<OperationSummaryResponseDto> {
        return this.stablecoinService.handleBurnRequest(dto);
    }

    @Post("freeze")
    @ApiOperation({ summary: "Create or confirm a freeze multisig request" })
    @ApiOkResponse({ type: OperationSummaryResponseDto })
    freeze(@Body() dto: FreezeRequestDto): Promise<OperationSummaryResponseDto> {
        return this.stablecoinService.handleFreezeRequest(dto);
    }

    @Get("status/:txId")
    @ApiOperation({ summary: "Get request status" })
    @ApiParam({ name: "txId", example: "4f176c1e-9c30-49cc-bc15-0f2e9e8a38a6" })
    @ApiOkResponse({ type: TransactionStatusResponseDto })
    status(@Param("txId") txId: string): Promise<TransactionStatusResponseDto> {
        return this.stablecoinService.getStatus(txId);
    }

    @Get("balance/:address")
    @ApiOperation({ summary: "Get stablecoin balance" })
    @ApiParam({ name: "address", example: "0x1111111111111111111111111111111111111111" })
    @ApiOkResponse({ type: BalanceResponseDto })
    balance(@Param("address") address: string): Promise<BalanceResponseDto> {
        return this.stablecoinService.getBalance(address);
    }
}
