import { ApiProperty } from "@nestjs/swagger";

export class ErrorResponseDto {
    @ApiProperty({
        description: "HTTP status code.",
        example: 400,
    })
    statusCode!: number;

    @ApiProperty({
        description: "Human-readable error message.",
        example: "Missing to or amount.",
        oneOf: [
            { type: "string" },
            {
                type: "array",
                items: { type: "string" },
            },
        ],
    })
    message!: string | string[];

    @ApiProperty({
        description: "HTTP error label.",
        example: "Bad Request",
    })
    error!: string;
}
