import * as lucide from "lucide-react";
const missing = ["Apple", "Grape", "Nut", "Trees"].filter(name => !lucide[name]);
console.log("Missing:", missing);
