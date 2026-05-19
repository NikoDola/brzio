import Image from "next/image";
import Link from "next/link";
import { getPosts } from "@/lib/content";
import "./HomePage.css";

export default async function HomePage() {
  const games = await getPosts({ type: "game", publishedOnly: true });

  return (
    <div className="home">
      <section className="home-games">
        <div className="home-games-inner">
          {games.length === 0 ? (
            <div className="home-games-empty">
              <p>No games published yet. Check back soon.</p>
            </div>
          ) : (
            <div className="home-games-grid">
              {games.map((game) => (
                <Link key={game.id} href={`/games/${game.slug}`} className="home-game-card">
                  <div className="home-game-card-image">
                    {game.thumbnail ? (
                      <Image
                        src={game.thumbnail}
                        alt={game.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div className="home-game-card-placeholder">
                        <span>{game.title.charAt(0)}</span>
                      </div>
                    )}
                    <div className="home-game-card-play" aria-hidden="true">
                      <span>▶</span>
                    </div>
                  </div>
                  <div className="home-game-card-body">
                    <h2 className="home-game-card-title">{game.title}</h2>
                    {game.excerpt && (
                      <p className="home-game-card-excerpt">{game.excerpt}</p>
                    )}
                    {game.tags.length > 0 && (
                      <div className="home-game-card-tags">
                        {game.tags.slice(0, 3).map((t) => (
                          <span key={t} className="home-game-tag">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
