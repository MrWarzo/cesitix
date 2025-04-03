"use client";

import { useState, useEffect } from "react";
import {
    Box,
    TextInput,
    Text,
    Button,
    Stack,
    ScrollArea,
    Group,
    Card,
} from "@mantine/core";

type Word = {
    text: string;
    found: boolean;
    originalIndex: number;
    isLastFound?: boolean;
};

type ArticleWord = {
    text: string;
    isWord: boolean;
    index: number;
};

type GameStats = {
    articlesFound: number;
    history: Array<{
        title: string;
        attempts: number;
        date: string;
    }>;
};

function PedantixGame() {
    const [articleWords, setArticleWords] = useState<ArticleWord[]>([]);
    const [titleWords, setTitleWords] = useState<ArticleWord[]>([]);
    const [title, setTitle] = useState<string>("");
    const [words, setWords] = useState<Word[]>([]);
    const [input, setInput] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [gameWon, setGameWon] = useState<boolean>(false);
    const [history, setHistory] = useState<string[]>([]);
    const [attempts, setAttempts] = useState<number>(0);
    const [hoveredWordIndex, setHoveredWordIndex] = useState<number | null>(
        null
    );
    const [error, setError] = useState<string>("");
    const [gameStats, setGameStats] = useState<GameStats>({
        articlesFound: 0,
        history: [],
    });

    function normalizeText(text: string): string {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function wordExists(word: string): string[] {
        const normalizedWord = normalizeText(word);
        const foundWords: string[] = [];

        console.log("titleWords", titleWords);
        console.log("word", word);

        // Vérifier dans le titre
        titleWords
            .filter((w) => w.isWord)
            .forEach((w) => {
                const normalizedText = normalizeText(w.text);
                if (normalizedText === normalizedWord) {
                    foundWords.push(w.text);
                }
            });

        // Vérifier dans le contenu
        words.forEach((w) => {
            const normalizedText = normalizeText(w.text);
            if (normalizedText === normalizedWord) {
                foundWords.push(w.text);
            }
        });

        // Dédupliquer les mots trouvés
        return [...new Set(foundWords)];
    }

    function processText(text: string): [ArticleWord[], Word[]] {
        const articleWords: ArticleWord[] = [];
        const words: Word[] = [];
        let wordIndex = 0;

        // On sépare d'abord sur les espaces et la ponctuation sauf les parenthèses
        const tokens = text.split(/(['".,!?;:\s\n-]+)/)
            .flatMap(token => {
                // Si le token contient un nombre suivi de lettres (ex: 5e, 2ème, etc.)
                // on le sépare en plusieurs tokens
                const match = token.match(/^(\d+)([a-zÀ-ÿ]+)$/i);
                if (match) {
                    return [match[1], match[2]];
                }
                // Si le token contient des parenthèses, on les sépare
                if (token.includes('(') || token.includes(')')) {
                    return token.split(/([()])/);
                }
                return token;
            });

        tokens.forEach((token) => {
            // Les parenthèses et la ponctuation sont des caractères spéciaux
            if (/^['".,!?;:\s\n-]+$/.test(token) || token === '(' || token === ')') {
                articleWords.push({
                    text: token,
                    isWord: false,
                    index: -1,
                });
            } else if (token.trim().length > 0) {
                articleWords.push({
                    text: token,
                    isWord: true,
                    index: wordIndex,
                });
                words.push({
                    text: token.toLowerCase(),
                    found: false,
                    originalIndex: wordIndex,
                    isLastFound: false,
                });
                wordIndex++;
            }
        });

        return [articleWords, words];
    }

    function loadGameStats() {
        const savedStats = localStorage.getItem("pedantixStats");
        if (savedStats) {
            setGameStats(JSON.parse(savedStats));
        }
    }

    function saveGameStats(title: string) {
        const newStats: GameStats = {
            articlesFound: gameStats.articlesFound + 1,
            history: [
                {
                    title,
                    attempts,
                    date: new Date().toISOString(),
                },
                ...gameStats.history,
            ],
        };
        localStorage.setItem("pedantixStats", JSON.stringify(newStats));
        setGameStats(newStats);
    }

    function fetchRandomArticle() {
        setLoading(true);
        setHistory([]);
        setAttempts(0);
        setGameWon(false);

        fetch("/api/wikipedia")
            .then((response) => response.json())
            .then(({ content, title }) => {
                setTitle(title);

                const [processedTitle] = processText(title);
                setTitleWords(processedTitle);

                const [processedArticle, contentWords] = processText(content);
                setArticleWords(processedArticle);

                setWords(contentWords);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }

    async function checkWord(word: string) {
        const normalizedWord = word.toLowerCase().trim();
        
        if (normalizedWord.length === 0) {
            return;
        }

        // Vérifier si le mot a déjà été testé
        if (history.some(h => h === normalizedWord)) {
            setError("Ce mot a déjà été testé");
            setInput("");
            return;
        }

        // Vérifier si le mot existe dans l'article ou le titre
        const foundWords = wordExists(normalizedWord);

        // Si le mot n'est pas dans l'article ni dans le titre
        if (foundWords.length === 0) {
            try {
                // Dans ce cas seulement, on vérifie si c'est un mot français
                const response = await fetch("/api/check-word", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ word: normalizedWord }),
                });
                const { isValid, error } = await response.json();

                if (error) {
                    setError(error);
                    setInput("");
                    return;
                }
                if (!isValid) {
                    setError("Ce mot n'existe pas en français");
                    setInput("");
                    return;
                }
                // Si le mot est valide mais pas dans l'article, on l'ajoute quand même à l'historique
                setError("Ce mot n'existe pas dans l'article");
                setAttempts((prev) => prev + 1);
                setHistory((prev) => [normalizedWord, ...prev]);
                setInput("");
                return;
            } catch {
                setError("Erreur lors de la vérification du mot");
                setInput("");
                return;
            }
        }

        // Vérifier si les mots ont déjà été trouvés
        // On utilise un Set pour s'assurer qu'un mot n'apparaît qu'une seule fois
        const newWords = new Set(foundWords.map(w => w.toLowerCase()).filter(w => 
            !history.some(h => h === w)
        ));
        const uniqueNewWords = Array.from(newWords);

        if (uniqueNewWords.length === 0) {
            setError("Ce mot a déjà été trouvé");
            setInput("");
            return;
        }

        setError("");
        setAttempts((prev) => prev + 1);
        
        // On s'assure que l'historique ne contient pas de doublons et que tout est en minuscules
        const updatedHistory = [...uniqueNewWords, ...history];
        const uniqueHistory = Array.from(new Set(updatedHistory));
        setHistory(uniqueHistory);

        setWords((prevWords) => {
            const resetWords = prevWords.map((w) => ({
                ...w,
                isLastFound: false,
            }));
            
            return resetWords.map((w) => {
                if (uniqueNewWords.some(newWord => normalizeText(w.text) === newWord) && !w.found) {
                    return { ...w, found: true, isLastFound: true };
                }
                return w;
            });
        });

        const titleWordsFound = titleWords
            .filter((word) => word.isWord)
            .every((word) => {
                const normalizedTitleWord = normalizeText(word.text);
                return uniqueHistory.some(h => h === normalizedTitleWord);
            });

        if (titleWordsFound) {
            setGameWon(true);
            saveGameStats(title);
            setWords((prevWords) => prevWords.map((w) => ({ ...w, found: true })));
        }

        setInput("");
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        checkWord(input).catch(() => {
            setError("Erreur lors de la vérification du mot");
            setInput("");
        });
    }

    function getWordInfo(index: number): {
        found: boolean;
        isLastFound: boolean;
    } {
        const word = words.find((w) => w.originalIndex === index);
        return {
            found: word?.found || gameWon,
            isLastFound: !gameWon && (word?.isLastFound || false),
        };
    }

    function getTitleWordInfo(word: string): {
        found: boolean;
        isLastFound: boolean;
    } {
        return {
            found:
                gameWon ||
                history.some((w) => w.toLowerCase() === word.toLowerCase()),
            isLastFound:
                !gameWon && history[0]?.toLowerCase() === word.toLowerCase(),
        };
    }

    function getMaskedWord(text: string, found: boolean) {
        if (found) return text;
        return "█".repeat(text.length);
    }

    useEffect(() => {
        loadGameStats();
        fetchRandomArticle();
    }, []);

    if (loading) {
        return (
            <Box ta="center" p="xl">
                <Text>Chargement de l&apos;article...</Text>
            </Box>
        );
    }

    return (
        <Box p="md">
            <Card shadow="sm" p="md" withBorder>
                <Stack>
                    <form onSubmit={handleSubmit}>
                        <TextInput
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                setError("");
                            }}
                            placeholder="Entrez un mot"
                            disabled={gameWon}
                            error={error}
                        />
                    </form>

                    <Group>
                        <Box>
                            <Text>Mots testés : {attempts}</Text>
                            <Text>
                                Articles trouvés : {gameStats.articlesFound}
                            </Text>
                        </Box>
                        <Button
                            onClick={fetchRandomArticle}
                            variant="filled"
                            color="green"
                        >
                            Nouvelle partie
                        </Button>
                    </Group>

                    <ScrollArea h={200}>
                        <Text size="sm" fw={700}>
                            Historique des mots testés :
                        </Text>
                        {history.map((word, index) => (
                            <Text key={index} size="sm" c="dimmed">
                                {word}
                            </Text>
                        ))}
                    </ScrollArea>

                    <Box style={{ textAlign: "justify" }}>
                        <Box>
                            <Button onClick={() => alert(title)}>
                                Solution
                            </Button>
                            <Box
                                style={{
                                    fontSize: "1.5rem",
                                    textAlign: "start",
                                    marginBottom: "1rem",
                                    fontWeight: "bold",
                                }}
                            >
                                {titleWords.map((word, index) => (
                                    <span
                                        key={index}
                                        style={{
                                            display: "inline",
                                            whiteSpace: word.isWord
                                                ? "nowrap"
                                                : "pre-wrap",
                                            position: "relative",
                                        }}
                                    >
                                        {word.isWord ? (
                                            <span
                                                onMouseEnter={() =>
                                                    setHoveredWordIndex(
                                                        word.index
                                                    )
                                                }
                                                onMouseLeave={() =>
                                                    setHoveredWordIndex(null)
                                                }
                                                style={{
                                                    color: getTitleWordInfo(
                                                        word.text
                                                    ).isLastFound
                                                        ? "#4CAF50"
                                                        : getTitleWordInfo(
                                                              word.text
                                                          ).found
                                                        ? "white"
                                                        : "black",
                                                    position: "relative",
                                                }}
                                            >
                                                {getMaskedWord(
                                                    word.text,
                                                    getTitleWordInfo(word.text)
                                                        .found
                                                )}
                                                {hoveredWordIndex ===
                                                    word.index &&
                                                    !getTitleWordInfo(word.text)
                                                        .found && (
                                                        <span
                                                            style={{
                                                                position:
                                                                    "absolute",
                                                                left: "50%",
                                                                transform:
                                                                    "translateX(-50%)",
                                                                color: "black",
                                                                fontSize:
                                                                    "0.8em",
                                                                top: "50%",
                                                                marginTop:
                                                                    "-0.6em",
                                                                background:
                                                                    "white",
                                                                padding:
                                                                    "0 4px",
                                                                pointerEvents:
                                                                    "none",
                                                            }}
                                                        >
                                                            {word.text.length}
                                                        </span>
                                                    )}
                                            </span>
                                        ) : (
                                            word.text
                                        )}
                                    </span>
                                ))}
                            </Box>
                        </Box>

                        {articleWords.map((word, index) => (
                            <span
                                key={index}
                                style={{
                                    display: "inline",
                                    whiteSpace: word.isWord
                                        ? "nowrap"
                                        : "pre-wrap",
                                    position: "relative",
                                }}
                            >
                                {word.isWord ? (
                                    <span
                                        onMouseEnter={() =>
                                            setHoveredWordIndex(word.index)
                                        }
                                        onMouseLeave={() =>
                                            setHoveredWordIndex(null)
                                        }
                                        style={{
                                            color: getWordInfo(word.index)
                                                .isLastFound
                                                ? "#4CAF50"
                                                : getWordInfo(word.index).found
                                                ? "white"
                                                : "black",
                                            position: "relative",
                                        }}
                                    >
                                        {getMaskedWord(
                                            word.text,
                                            getWordInfo(word.index).found
                                        )}
                                        {hoveredWordIndex === word.index &&
                                            !getWordInfo(word.index).found && (
                                                <span
                                                    style={{
                                                        position: "absolute",
                                                        left: "50%",
                                                        transform:
                                                            "translateX(-50%)",
                                                        color: "black",
                                                        fontSize: "0.8em",
                                                        top: "50%",
                                                        marginTop: "-0.6em",
                                                        background: "white",
                                                        padding: "0 4px",
                                                        pointerEvents: "none",
                                                    }}
                                                >
                                                    {word.text.length}
                                                </span>
                                            )}
                                    </span>
                                ) : (
                                    word.text
                                )}
                            </span>
                        ))}
                    </Box>
                </Stack>
            </Card>
        </Box>
    );
}

export default PedantixGame;
