import LoginForm from "@/components/LoginForm";
import LoginRoute from "@/components/LoginRoute";

export default function LoginPage() {
  return (
    <div className="fixed inset-0 flex flex-col overflow-y-auto bg-gold-100 lg:block">
      <div className="flex min-h-full flex-col lg:h-full lg:flex-row">
        {/* Moitié image : photo + voile */}
        <div className="relative h-44 w-full shrink-0 overflow-hidden sm:h-56 lg:h-full lg:w-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/login-hero.webp"
            alt=""
            aria-hidden="true"
            className="login-hero-img absolute inset-0 h-full w-full object-cover object-[50%_62%]"
          />
          {/* Film jaune transparent — opaque en bord droit : jonction invisible avec la moitié jaune */}
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden bg-gradient-to-r from-gold-100/0 via-gold-100/35 to-gold-100 lg:block"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-gold-100 via-gold-100/25 to-transparent lg:hidden"
          />
        </div>

        {/* Moitié jaune pâle : route de suivi bleue à droite de la carte */}
        <div className="relative flex w-full flex-1 flex-col items-center justify-center px-4 py-8 lg:w-1/2 lg:py-0">
          <LoginRoute />

          {/* Zone de connexion, centrée sur l'écran */}
          <div className="w-full max-w-[420px] lg:fixed lg:left-1/2 lg:top-1/2 lg:z-20 lg:w-[420px] lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
