import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEthereumAddress, IsOptional, IsString } from "class-validator";

export class BurnRequestDto {
    @ApiPropertyOptional({
        description: "Existing API transaction id to confirm.",
        example: "4f176c1e-9c30-49cc-bc15-0f2e9e8a38a6",
    })
    @IsOptional()
    @IsString()
    txId?: string;

    @ApiPropertyOptional({
        description: "Wallet address to burn tokens from.",
        example: "0x1111111111111111111111111111111111111111",
    })
    @IsOptional()
    @IsEthereumAddress()
    from?: string;

    @ApiPropertyOptional({
        description: "Token amount in decimal units.",
        example: "250.00",
    })
    @IsOptional()
    @IsString()
    amount?: string;

    @ApiProperty({
        description: "Configured signer label.",
        example: "owner1",
    })
    @IsString()
    signer!: string;
}
