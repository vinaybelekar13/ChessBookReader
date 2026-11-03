import { useState } from "react";
import { HelmetProvider } from "@dr.pogodin/react-helmet";
import { Button, HeroUIProvider } from "@heroui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import Board from "./components/board/Board";
import Controls from "./components/controls/Controls";
import "./game-review.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function Fallback({ error }: { error: Error }) {
  return (
    <div className="flex h-screen flex-col gap-2 p-8" role="alert">
      <p className="text-2xl">Something went wrong:</p>
      <code className="inline-block text-small text-danger-500">
        {error.message}
      </code>
      <div className="flex gap-1">
        <Button
          onPress={() => {
            window.location.reload();
          }}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}

export default function GameReviewWorkspace({ onExit }: { onExit?: () => void }) {
  void onExit;
  const [client] = useState(() => queryClient);

  return (
    <section className="game-review-workspace" aria-label="Game Review">
      {/* Main Game Review Area */}
      <div className="game-review-stage-container">
        <QueryClientProvider client={client}>
          <HeroUIProvider disableRipple>
            <HelmetProvider>
              <div className="dark bg-default-50 text-foreground relative h-full w-full overflow-hidden font-sans select-none flex flex-col">
                <div
                  className={`
                    absolute hidden h-full w-full overflow-hidden pointer-events-none
                    mask-radial-[100%_100%] mask-radial-from-25% mask-radial-at-center
                    sm:block
                  `}
                >
                  <img
                    alt="background gradient"
                    className="absolute top-1/5 left-1/2 w-screen"
                    src={`${import.meta.env.BASE_URL}game-review/gradient.png`}
                  />
                </div>
                <ErrorBoundary FallbackComponent={Fallback}>
                  <div
                    className={`
                      mx-auto w-full h-full overflow-y-auto overflow-x-hidden p-3
                      xs:p-4 lg:p-6 flex flex-col
                    `}
                    id="App"
                  >
                    <div className="game-review-board-controls">
                      <Board />
                      <Controls />
                    </div>
                  </div>
                </ErrorBoundary>
              </div>
            </HelmetProvider>
          </HeroUIProvider>
        </QueryClientProvider>
      </div>
    </section>
  );
}



