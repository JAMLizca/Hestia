import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { cuentaApi, reservasWebApi } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { Pantalla, Resumen } from "../features/reservasWeb/Comunes";
import { configureFormat } from "../utils/format";

/** Una reserva con sus propias acciones (pagar el anticipo, cancelar) y su propio estado de carga. */
function TarjetaReserva({ reserva, hotel, onCambio }) {
  const [cancelando, setCancelando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState("");
  const [pagando, setPagando] = useState(false);
  const [errorPago, setErrorPago] = useState("");

  async function cancelar() {
    setErrorCancelar("");
    setCancelando(true);
    try {
      onCambio(await cuentaApi.cancelar(reserva.codigo));
    } catch (err) {
      setErrorCancelar(err.message);
    } finally {
      setCancelando(false);
    }
  }

  async function pagar() {
    setErrorPago("");
    setPagando(true);
    try {
      const { url } = await cuentaApi.pagar(reserva.codigo);
      window.location.assign(url); // checkout de Wompi
    } catch (err) {
      setErrorPago(err.message);
      setPagando(false);
    }
  }

  return <Resumen r={reserva} hotel={hotel} onCancelar={cancelar} cancelando={cancelando} errorCancelar={errorCancelar} onPagar={pagar} pagando={pagando} errorPago={errorPago} />;
}

/** Las reservas hechas con la cuenta del huésped. Es solo para cuentas de huésped. */
export default function MisReservasPage() {
  const { status, esCliente, esPersonal } = useAuth();
  const [hotel, setHotel] = useState(null);
  const [reservas, setReservas] = useState(null);
  const [error, setError] = useState("");

  const cargar = useCallback(() => {
    setError("");
    return Promise.all([reservasWebApi.hotel(), cuentaApi.reservas()])
      .then(([h, lista]) => {
        configureFormat({ moneda: h.moneda });
        setHotel(h);
        setReservas(lista);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (esCliente) cargar();
  }, [esCliente, cargar]);

  if (status === "loading") {
    return (
      <Pantalla>
        <section className="pc__card pc__state" aria-busy="true">
          <Loader2 className="pc__spin" size={22} />
          <p>Cargando…</p>
        </section>
      </Pantalla>
    );
  }
  if (esPersonal) return <Navigate to="/dashboard" replace />;
  if (!esCliente) return <Navigate to="/login" replace state={{ from: { pathname: "/mis-reservas", search: "" } }} />;

  return (
    <Pantalla hotel={hotel}>
      <section className="pc__card mr__head">
        <h1>Mis reservas</h1>
        <Link to="/reservar" className="rv__btn rv__btn--primary">
          <Plus size={14} /> Nueva reserva
        </Link>
      </section>

      {error && (
        <section className="pc__card pc__state" role="alert">
          <p>{error}</p>
          <button type="button" className="pc__link" onClick={cargar}>
            Intentar de nuevo
          </button>
        </section>
      )}
      {!error && reservas === null && (
        <section className="pc__card pc__state" aria-busy="true">
          <Loader2 className="pc__spin" size={22} />
          <p>Cargando tus reservas…</p>
        </section>
      )}
      {reservas?.length === 0 && (
        <section className="pc__card pc__state">
          <h2>Aún no tienes reservas</h2>
          <p>Busca fechas y elige tu habitación: tus reservas aparecerán aquí.</p>
          <Link to="/reservar" className="pc__submit" style={{ textDecoration: "none", justifyContent: "center" }}>
            Reservar ahora
          </Link>
        </section>
      )}
      {reservas?.length > 0 && (
        <div className="mr__list">
          {reservas.map((r) => (
            <TarjetaReserva key={r.codigo} reserva={r} hotel={hotel} onCambio={(nueva) => setReservas((lista) => lista.map((x) => (x.codigo === nueva.codigo ? nueva : x)))} />
          ))}
        </div>
      )}
    </Pantalla>
  );
}
