-- CreateTable
CREATE TABLE "public"."Captcha" (
    "id" UUID NOT NULL,
    "ip" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "fc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Captcha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Captcha_ip_idx" ON "public"."Captcha"("ip");

-- CreateIndex
CREATE UNIQUE INDEX "Captcha_challenge_ip_key" ON "public"."Captcha"("challenge", "ip");
