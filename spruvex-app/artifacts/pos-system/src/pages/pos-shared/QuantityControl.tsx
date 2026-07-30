import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

export function QuantityControl({
  quantity,
  onChange,
}: {
  quantity: number;
  onChange: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => onChange(-1)}>
        <Minus className="h-3 w-3" />
      </Button>
      <span className="w-7 text-center text-sm font-medium">{quantity}</span>
      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => onChange(1)}>
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
