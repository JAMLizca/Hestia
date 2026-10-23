ALTER TABLE pagos
    ADD COLUMN referencia VARCHAR(64) NULL,
    ADD COLUMN transaccion_id VARCHAR(64) NULL,
    ADD UNIQUE INDEX uq_pagos_referencia (referencia);

ALTER TABLE configuracion_hotel
    ADD COLUMN anticipo_porcentaje INT NOT NULL DEFAULT 0;
