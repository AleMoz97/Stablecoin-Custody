import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TransactionStatusResponseDto {
    @ApiProperty({
        description: "API transaction id.",
        example: "4f176c1e-9c30-49cc-bc15-0f2e9e8a38a6",
    })
    txId!: string;

    @ApiProperty({
        description: "Requested operation type.",
        example: "MINT",
        enum: ["MINT", "BURN", "FREEZE"],
    })
    operationType!: string;

    @ApiProperty({
        description: "Transaction id inside the multisig contract.",
        example: "0",
    })
    multisigTxId!: string;

    @ApiProperty({
        description: "Current multisig execution status.",
        example: "PENDING_CONFIRMATIONS",
        enum: ["PENDING_CONFIRMATIONS", "EXECUTED"],
    })
    status!: string;

    @ApiProperty({
        description: "Number of confirmations currently collected on-chain.",
        example: 1,
    })
    confirmations!: number;

    @ApiProperty({
        description: "Date when the API transaction was created.",
        example: "2026-05-30T14:25:43.511Z",
    })
    createdAt!: Date;

    @ApiPropertyOptional({
        description: "Decoded stablecoin function name.",
        example: "mint",
    })
    function?: string;

    @ApiPropertyOptional({
        description: "Wallet address involved in the decoded operation.",
        example: "0x1111111111111111111111111111111111111111",
    })
    address?: string;

    @ApiPropertyOptional({
        description: "Token amount in decimal units.",
        example: "1000.50",
    })
    amount?: string;
}
