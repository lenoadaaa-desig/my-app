-- CreateIndex
CREATE INDEX "bookings_booking_date_status_idx" ON "bookings"("booking_date", "status");

-- CreateIndex
CREATE INDEX "profiles_role_idx" ON "profiles"("role");

-- CreateIndex
CREATE INDEX "profiles_created_at_idx" ON "profiles"("created_at");

-- CreateIndex
CREATE INDEX "restaurants_owner_id_idx" ON "restaurants"("owner_id");
