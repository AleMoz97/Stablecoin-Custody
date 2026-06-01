import { ApiProperty } from "@nestjs/swagger";

export class BalanceResponseDto {
    @ApiProperty({
        description: "Wallet address.",
        example: "0x1111111111111111111111111111111111111111",
    })
    address!: string;

    @ApiProperty({
        description: "Token balance in decimal units.",
        example: "1000.50",
    })
    balance!: string;

    @ApiProperty({
        description: "Token balance in raw base units.",
        example: "1000500000",
    })
    rawBalance!: string;

    @ApiProperty({
        description: "Stablecoin decimals.",
        example: 6,
    })
    decimals!: number;
}
