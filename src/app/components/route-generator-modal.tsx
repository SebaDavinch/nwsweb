import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import * as Slider from "@radix-ui/react-slider";
import { X, ChevronDown, Check, Clock, MapPin, RefreshCcw, Send } from "lucide-react";

// Inline utility for class names if needed
function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

interface RouteGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAirline?: string;
  defaultAircraft?: string;
}

interface GeneratedRoute {
    airline: string;
    flightNumber: string;
    aircraft: string;
    registration: string;
    totalTime: string;
    totalDistance: string;
    legs: number;
    route: Array<{ from: string; to: string }>;
}

export function RouteGeneratorModal({ open, onOpenChange, defaultAirline = "NWS", defaultAircraft = "B737-800" }: RouteGeneratorModalProps) {
  const [airline, setAirline] = useState(defaultAirline);
  const [aircraftType, setAircraftType] = useState(defaultAircraft);
  const [maxLegs, setMaxLegs] = useState([5]);
  const [maxDistance, setMaxDistance] = useState([5000]);
  const [maxTime, setMaxTime] = useState([8]);
  const [isGenerating, setIsGenerating] = useState(false);
    const [generatedRoute, setGeneratedRoute] = useState<GeneratedRoute | null>(null);

  const handleGenerate = () => {
    setIsGenerating(true);
    // Simulate API call
    setTimeout(() => {
      setIsGenerating(false);
      setGeneratedRoute({
        airline: "Nordwind Airlines",
        flightNumber: "NWS5870",
        aircraft: "B787-9",
        registration: "VQ-BHM",
        totalTime: "3h 10m",
        totalDistance: "2532 km",
        legs: 2,
        route: [
          { from: "UUEE", to: "ULLI" },
          { from: "ULLI", to: "UUDD" }
        ]
      });
    }, 1500);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-[2001] grid w-full max-w-6xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-0 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg overflow-hidden h-[90vh]">
            
          <div className="flex h-full">
            {/* Sidebar Controls */}
            <div className="w-[400px] bg-white border-r border-gray-200 p-6 flex flex-col h-full overflow-y-auto shrink-0">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">Where2Fly - Планировщик</h2>
                    <p className="text-sm text-gray-500 mt-1">Создавайте маршруты полетов по своим предпочтениям</p>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-gray-700 font-bold">
                        <FilterIcon /> Фильтры
                    </div>
                    <button 
                        className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 bg-gray-100 px-2 py-1 rounded transition-colors"
                        onClick={() => {
                            setMaxLegs([5]);
                            setMaxDistance([5000]);
                            setMaxTime([8]);
                        }}
                    >
                        <RefreshCcw size={12} /> Сбросить
                    </button>
                </div>

                <div className="space-y-6 flex-1">
                    {/* Airline Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Авиакомпания</label>
                        <Select.Root value={airline} onValueChange={setAirline}>
                            <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E31E24] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                <Select.Value placeholder="Select airline" />
                                <Select.Icon>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Select.Icon>
                            </Select.Trigger>
                            <Select.Portal>
                                <Select.Content className="relative z-[2002] min-w-[8rem] overflow-hidden rounded-md border bg-white shadow-md animate-in fade-in-80">
                                    <Select.Viewport className="p-1">
                                        <SelectItem value="NWS">Nordwind Airlines (NWS)</SelectItem>
                                        <SelectItem value="KAR">Ikar Airlines (KAR)</SelectItem>
                                        <SelectItem value="STW">Southwind Airlines (STW)</SelectItem>
                                    </Select.Viewport>
                                </Select.Content>
                            </Select.Portal>
                        </Select.Root>
                    </div>

                    {/* Aircraft Type */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Тип ВС</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['B737-800', 'A321-200', 'B777-300ER', 'A330-300', 'A320-200', 'B787-9'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setAircraftType(type)}
                                    className={classNames(
                                        "px-3 py-2 text-xs font-medium rounded-md border transition-all",
                                        aircraftType === type 
                                            ? "bg-[#E31E24] text-white border-[#E31E24] shadow-md" 
                                            : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                    )}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Registration */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Регистрация</label>
                        <Select.Root defaultValue="any">
                            <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E31E24] focus:ring-offset-2">
                                <Select.Value placeholder="Select registration" />
                                <Select.Icon>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Select.Icon>
                            </Select.Trigger>
                            <Select.Portal>
                                <Select.Content className="relative z-[2002] min-w-[8rem] overflow-hidden rounded-md border bg-white shadow-md animate-in fade-in-80">
                                    <Select.Viewport className="p-1">
                                        <SelectItem value="any">Любая регистрация</SelectItem>
                                        <SelectItem value="RA-73245">RA-73245</SelectItem>
                                        <SelectItem value="RA-73246">RA-73246</SelectItem>
                                    </Select.Viewport>
                                </Select.Content>
                            </Select.Portal>
                        </Select.Root>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-6 pt-4 border-t border-gray-100">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-gray-700">Макс. количество лэгов: {maxLegs[0]}</label>
                            </div>
                            <Slider.Root 
                                className="relative flex w-full touch-none select-none items-center" 
                                value={maxLegs} 
                                onValueChange={setMaxLegs} 
                                max={10} 
                                min={1} 
                                step={1}
                            >
                                <Slider.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200">
                                    <Slider.Range className="absolute h-full bg-black" />
                                </Slider.Track>
                                <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-black bg-white ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
                            </Slider.Root>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-gray-700">Макс. дистанция: {maxDistance[0]} km</label>
                            </div>
                            <Slider.Root 
                                className="relative flex w-full touch-none select-none items-center" 
                                value={maxDistance} 
                                onValueChange={setMaxDistance} 
                                max={10000} 
                                min={100} 
                                step={100}
                            >
                                <Slider.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200">
                                    <Slider.Range className="absolute h-full bg-black" />
                                </Slider.Track>
                                <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-black bg-white ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
                            </Slider.Root>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-gray-700">Макс. время: {maxTime[0]}h 0m</label>
                            </div>
                            <Slider.Root 
                                className="relative flex w-full touch-none select-none items-center" 
                                value={maxTime} 
                                onValueChange={setMaxTime} 
                                max={24} 
                                min={1} 
                                step={1}
                            >
                                <Slider.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200">
                                    <Slider.Range className="absolute h-full bg-black" />
                                </Slider.Track>
                                <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-black bg-white ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
                            </Slider.Root>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <button 
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full bg-[#E31E24] hover:bg-[#c41a1f] disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                        {isGenerating ? (
                            <RefreshCcw className="animate-spin" size={20} />
                        ) : (
                            <Send size={18} className="-ml-1 rotate-45" />
                        )}
                        <span className="uppercase tracking-wide text-sm">{isGenerating ? "Генерируем..." : "Сгенерировать маршрут"}</span>
                    </button>
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 bg-gray-100 relative flex flex-col">
                <div className="flex-1 relative z-0">
                   {/* We reuse LiveMap but pass no flights or specific mock flights to visualize the route */}
                   <div className="absolute inset-0 bg-[#e5e7eb] flex items-center justify-center">
                        {/* Placeholder for map - in real app would be Leaflet instance */}
                        <div className="text-center text-gray-400">
                             <MapIconPlaceholder />
                             <p className="mt-2 text-sm">Карта маршрутов</p>
                        </div>
                        {/* Overlay actual map if possible, but keep simple for now */}
                   </div>
                   {/* Simplified Map Overlay - just an image or basic div for now as full map integration requires complex state */}
                   <div className="absolute inset-0 opacity-50 bg-[url('https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/6/38/22.png')] bg-cover bg-center"></div>
                   
                   {/* Route Visualization (CSS based for demo) */}
                   {generatedRoute && (
                       <svg className="absolute inset-0 w-full h-full pointer-events-none">
                           <path d="M 400 300 Q 500 200 600 250 T 800 350" fill="none" stroke="#E31E24" strokeWidth="3" strokeDasharray="10 5" className="animate-dash" />
                           <circle cx="400" cy="300" r="4" fill="#E31E24" />
                           <circle cx="800" cy="350" r="4" fill="#E31E24" />
                       </svg>
                   )}
                </div>

                {/* Results Card (Bottom) */}
                {generatedRoute && (
                    <div className="absolute bottom-8 left-8 right-8 bg-white rounded-xl shadow-2xl border border-gray-200 p-6 animate-in slide-in-from-bottom-10 fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-10 bg-[#E31E24] rounded flex items-center justify-center text-white font-bold italic text-xl">
                                    NW
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-gray-900">{generatedRoute.airline}</div>
                                    <div className="text-sm text-gray-500">Flight {generatedRoute.flightNumber}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-gray-500">Воздушное судно</div>
                                <div className="text-lg font-bold text-gray-900">{generatedRoute.aircraft}</div>
                                <div className="text-xs font-mono text-[#E31E24]">{generatedRoute.registration}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2 text-[#E31E24] mb-1">
                                    <Clock size={16} />
                                </div>
                                <div className="text-xs text-gray-500 uppercase tracking-wide">Общее время</div>
                                <div className="text-xl font-bold text-gray-900">{generatedRoute.totalTime}</div>
                            </div>
                            <div className="text-center border-x border-gray-100">
                                <div className="flex items-center justify-center gap-2 text-[#E31E24] mb-1">
                                    <Send size={16} className="-rotate-45" />
                                </div>
                                <div className="text-xs text-gray-500 uppercase tracking-wide">Общая дистанция</div>
                                <div className="text-xl font-bold text-gray-900">{generatedRoute.totalDistance}</div>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2 text-[#E31E24] mb-1">
                                    <MapPin size={16} />
                                </div>
                                <div className="text-xs text-gray-500 uppercase tracking-wide">Лэги</div>
                                <div className="text-xl font-bold text-gray-900">{generatedRoute.legs}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Dialog.Close className="absolute right-4 top-4 rounded-full p-2 opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-gray-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const SelectItem = ({ children, className, ...props }: React.ComponentProps<typeof Select.Item>) => {
  return (
    <Select.Item
      className={classNames(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-gray-100 focus:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <Select.ItemIndicator>
          <Check className="h-4 w-4" />
        </Select.ItemIndicator>
      </span>
      <Select.ItemText>{children}</Select.ItemText>
    </Select.Item>
  );
};

function FilterIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    )
}

function MapIconPlaceholder() {
    return (
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
            <line x1="8" y1="2" x2="8" y2="18"></line>
            <line x1="16" y1="6" x2="16" y2="22"></line>
        </svg>
    )
}
