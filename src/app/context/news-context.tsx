import { createContext, useContext, useState, ReactNode } from "react";

export interface NewsItem {
  id: number;
  externalId?: number;
  source?: "local" | "vamsys";
  notamType?: "info" | "warning" | "critical";
  notamPriority?: "low" | "medium" | "high";
  mustRead?: boolean;
  tag?: string | null;
  linkUrl?: string | null;
  title: string;
  category: "News" | "NOTAM" | "Event";
  content: string;
  author: string;
  date: string;
  status: "Published" | "Draft" | "Archived";
  views: number;
  sendToDiscord: boolean;
}

interface NewsContextType {
  news: NewsItem[];
  addNews: (item: Omit<NewsItem, "id" | "views" | "date">) => void;
  updateNews: (id: number, item: Partial<NewsItem>) => void;
  deleteNews: (id: number) => void;
  replaceNotams: (items: NewsItem[]) => void;
  getNewsById: (id: number) => NewsItem | undefined;
}

const NewsContext = createContext<NewsContextType | undefined>(undefined);

const INITIAL_NEWS: NewsItem[] = [
  { 
    id: 1, 
    title: "Summer Schedule Update 2025", 
    category: "News", 
    content: "We are excited to announce our new summer schedule with increased frequencies to popular destinations including Antalya, Sochi, and Dubai. Pilots can now book these flights via vAMSYS.", 
    author: "Admin", 
    date: "2025-05-15",
    status: "Published",
    views: 245,
    sendToDiscord: true
  },
  { 
    id: 2, 
    title: "VATSIM Event: Moscow Fly-in", 
    category: "Event", 
    content: "Join us for a massive fly-in event at Moscow airports on VATSIM this Saturday. Full ATC coverage is expected from 1400z to 2000z.", 
    author: "Events Team", 
    date: "2025-06-01",
    status: "Published",
    views: 112,
    sendToDiscord: true
  },
  { 
    id: 3, 
    title: "ULLI Runway Maintenance", 
    category: "NOTAM", 
    content: "Runway 10R/28L at Pulkovo (ULLI) will be closed for scheduled maintenance daily between 0000Z and 0600Z until further notice. Please plan accordingly.", 
    author: "Ops", 
    date: "2025-05-20",
    status: "Published",
    views: 56,
    sendToDiscord: false
  },
  { 
    id: 4, 
    title: "New Fleet Addition: A321neo", 
    category: "News", 
    content: "We are proud to welcome the first Airbus A321neo to our virtual fleet. This modern aircraft offers better fuel efficiency and range for our medium-haul routes.", 
    author: "Fleet Mgr", 
    date: "2025-06-10",
    status: "Published",
    views: 89,
    sendToDiscord: true
  },
];

export function NewsProvider({ children }: { children: ReactNode }) {
  const [news, setNews] = useState<NewsItem[]>(INITIAL_NEWS);

  const addNews = (item: Omit<NewsItem, "id" | "views" | "date">) => {
    const newId = Math.max(...news.map(n => n.id), 0) + 1;
    const newItem: NewsItem = {
      ...item,
      id: newId,
      views: 0,
      date: new Date().toISOString().split('T')[0],
    };
    setNews([newItem, ...news]);
  };

  const updateNews = (id: number, updatedItem: Partial<NewsItem>) => {
    setNews(news.map(n => n.id === id ? { ...n, ...updatedItem } : n));
  };

  const deleteNews = (id: number) => {
    setNews(news.filter(n => n.id !== id));
  };

  const replaceNotams = (items: NewsItem[]) => {
    setNews((prev) => {
      const nonNotams = prev.filter((n) => n.category !== "NOTAM");
      return [...items, ...nonNotams];
    });
  };

  const getNewsById = (id: number) => {
    return news.find(n => n.id === id);
  };

  return (
    <NewsContext.Provider value={{ news, addNews, updateNews, deleteNews, replaceNotams, getNewsById }}>
      {children}
    </NewsContext.Provider>
  );
}

export function useNews() {
  const context = useContext(NewsContext);
  if (context === undefined) {
    throw new Error("useNews must be used within a NewsProvider");
  }
  return context;
}