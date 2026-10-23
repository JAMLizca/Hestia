ALTER TABLE reservas
    ADD COLUMN codigo VARCHAR(12) NULL,
    ADD COLUMN canal VARCHAR(20) NOT NULL DEFAULT 'presencial',
    ADD COLUMN notas VARCHAR(500) NULL,
    ADD COLUMN motivo_cancelacion VARCHAR(100) NULL;

UPDATE reservas SET codigo = CONCAT('HST-', LPAD(id, 6, '0')) WHERE codigo IS NULL;

ALTER TABLE reservas
    MODIFY COLUMN codigo VARCHAR(12) NOT NULL,
    ADD UNIQUE INDEX uq_reservas_codigo (codigo);

ALTER TABLE configuracion_hotel
    ADD COLUMN horas_vencimiento_pendiente INT NOT NULL DEFAULT 24;
