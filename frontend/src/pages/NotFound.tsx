import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-military font-bold text-cbt-orange">404</h1>
        <p className="text-xl text-gray-400 font-tactical">Pagina nao encontrada</p>
        <a
          href="/"
          className="inline-block mt-4 px-6 py-2 bg-cbt-orange text-black font-tactical font-semibold rounded-lg hover:bg-cbt-orange/90 transition-colors"
        >
          Voltar ao Inicio
        </a>
      </div>
    </div>
  );
};

export default NotFound;
