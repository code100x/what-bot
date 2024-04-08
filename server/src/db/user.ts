import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export async function getUser(number: string) {
    const user = await db.user.findFirst({
        where: {
            phone: number,
        },
        include: {
            privateKeys: true,
        }
    });

    if (!user) {
        return null
    }
    return user;
}