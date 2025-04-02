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
    const [hoveredWordIndex, setHoveredWordIndex] = useState<number | null>(null);
    const [gameStats, setGameStats] = useState<GameStats>({
        articlesFound: 0,
        history: [],
    });

    function processText(text: string): [ArticleWord[], Word[]] {
        const articleWords: ArticleWord[] = [];
        const words: Word[] = [];
        let wordIndex = 0;

        const tokens = text.split(/(['".,!?;:()\n\s]+)/);
        tokens.forEach((token) => {
            if (/^['",\.!?;:()\n\s]+$/.test(token)) {
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
                
                // Traiter le titre séparément
                const [processedTitle] = processText(title);
                setTitleWords(processedTitle);
                
                // Traiter le contenu
                const [processedArticle, contentWords] = processText(content);
                setArticleWords(processedArticle);
                
                // Ne garder que les mots du contenu
                setWords(contentWords);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }

    function checkWord(word: string) {
        const normalizedWord = word.toLowerCase().trim();
        
        if (normalizedWord.length === 0 || history.includes(normalizedWord)) {
            return;
        }

        setAttempts((prev) => prev + 1);
        setHistory((prev) => [normalizedWord, ...prev]);

        // Mettre à jour les mots trouvés
        setWords((prevWords) => {
            const resetWords = prevWords.map((w) => ({
                ...w,
                isLastFound: false,
            }));
            
            return resetWords.map((w) => {
                if (w.text === normalizedWord && !w.found) {
                    return { ...w, found: true, isLastFound: true };
                }
                return w;
            });
        });

        // Vérifier si tous les mots du titre sont trouvés
        const titleWordsFound = titleWords
            .filter(word => word.isWord)
            .every(word => {
                const normalizedTitleWord = word.text.toLowerCase().trim();
                return history.includes(normalizedTitleWord) || normalizedTitleWord === normalizedWord;
            });

        if (titleWordsFound) {
            setGameWon(true);
            saveGameStats(title);
            // Révéler tous les mots du contenu
            setWords((prevWords) => prevWords.map((w) => ({ ...w, found: true })));
        }
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        checkWord(input);
        setInput("");
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
        // Vérifier si le mot est dans l'historique ou si la partie est gagnée
        return {
            found: gameWon || history.some(w => w.toLowerCase() === word.toLowerCase()),
            isLastFound: !gameWon && history[0]?.toLowerCase() === word.toLowerCase(),
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
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Entrez un mot"
                            disabled={gameWon}
                        />
                    </form>

                    <Group>
                        <Box>
                            <Text>Mots testés : {attempts}</Text>
                            <Text>Articles trouvés : {gameStats.articlesFound}</Text>
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
                                                    color: getTitleWordInfo(word.text)
                                                        .isLastFound
                                                        ? "#4CAF50"
                                                        : getTitleWordInfo(word.text)
                                                              .found
                                                        ? "black"
                                                        : "#666",
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
                                                                color: "#666",
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
                                                ? "black"
                                                : "#666",
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
                                                        color: "#666",
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
