import { ApiProperty } from "@nestjs/swagger";

export class OperationSummaryResponseDto {
    @ApiProperty({
        description: "API transaction id.",
        example: "4f176c1e-9c30-49cc-bc15-0f2e9e8a38a6",
    })
    txId!: string;

    @ApiProperty({
        description: "Current multisig execution status.",
        example: "PENDING_CONFIRMATIONS",
        enum: ["PENDING_CONFIRMATIONS", "EXECUTED"],
    })
    status!: string;

    @ApiProperty({
        description: "Date when the API transaction was created.",
        example: "2026-05-30T14:25:43.511Z",
    })
    createdAt!: Date;
}
