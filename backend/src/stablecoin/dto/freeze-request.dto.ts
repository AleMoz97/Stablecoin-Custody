import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEthereumAddress, IsOptional, IsString } from "class-validator";

export class FreezeRequestDto {
    @ApiPropertyOptional({
        description: "Existing API transaction id to confirm.",
        example: "4f176c1e-9c30-49cc-bc15-0f2e9e8a38a6",
    })
    @IsOptional()
    @IsString()
    txId?: string;

    @ApiPropertyOptional({
        description: "Wallet address to freeze.",
        example: "0x1111111111111111111111111111111111111111",
    })
    @IsOptional()
    @IsEthereumAddress()
    account?: string;

    @ApiProperty({
        description: "Configured signer label.",
        example: "admin1",
    })
    @IsString()
    signer!: string;
}
