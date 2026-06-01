import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
    IsBoolean,
    IsEthereumAddress,
    IsOptional,
    IsString,
} from "class-validator";

export class MintRequestDto {
    @ApiPropertyOptional({
        description: "Existing API transaction id to confirm.",
        example: "4f176c1e-9c30-49cc-bc15-0f2e9e8a38a6",
    })
    @IsOptional()
    @IsString()
    txId?: string;

    @ApiPropertyOptional({
        description: "Recipient wallet address for a new mint request.",
        example: "0x1111111111111111111111111111111111111111",
    })
    @IsOptional()
    @IsEthereumAddress()
    to?: string;

    @ApiPropertyOptional({
        description: "Token amount in decimal units.",
        example: "1000.50",
    })
    @IsOptional()
    @IsString()
    amount?: string;

    @ApiPropertyOptional({
        description: "Whether the recipient passed the off-chain KYC check.",
        example: true,
    })
    @IsBoolean()
    kycPassed!: boolean;

    @ApiProperty({
        description: "Configured signer label.",
        example: "owner1",
    })
    @IsString()
    signer!: string;
}
