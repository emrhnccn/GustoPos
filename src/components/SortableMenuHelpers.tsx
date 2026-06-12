import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Edit3, Trash2, GripVertical, Star } from 'lucide-react';

export function SortableCategoryItem({ cat, isSelected, onSelect, onEdit, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`p-3 rounded-xl border flex items-center justify-between transition cursor-pointer ${
        isSelected
          ? 'bg-amber-500/10 border-amber-500/80 text-white font-semibold'
          : 'bg-zinc-900/40 border-zinc-850 text-zinc-400 hover:text-zinc-200'
      }`}
    >
      <div className="flex items-center space-x-2 truncate pr-2">
        <div {...attributes} {...listeners} className="cursor-grab hover:text-white p-1">
          <GripVertical className="w-4 h-4 text-zinc-500" />
        </div>
        <span className="truncate">
          {cat.name} <span className="text-[10px] text-zinc-500 ml-1">({cat.products?.length || 0} ürün)</span>
        </span>
      </div>
      <div className="flex items-center space-x-1.5 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(cat);
          }}
          className="hover:bg-amber-500/20 p-1 text-amber-400 rounded transition"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(cat);
          }}
          className="hover:bg-rose-500/20 p-1 text-rose-400 rounded transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function SortableProductItem({ prod, onEdit, onDelete, onToggleFavorite }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: prod.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? 'rgba(24, 24, 27, 0.8)' : undefined, // zinc-900 equivalent approx
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-zinc-900/20 text-zinc-300">
      <td className="p-3 font-semibold text-zinc-200">
        <div className="flex items-center space-x-2">
          <div {...attributes} {...listeners} className="cursor-grab hover:text-white p-1">
            <GripVertical className="w-4 h-4 text-zinc-500" />
          </div>
          {prod.image && (
            <img
              src={prod.image}
              alt={prod.name}
              className="w-7 h-7 rounded-lg object-cover border border-zinc-800 shrink-0"
            />
          )}
          <span>{prod.name}</span>
        </div>
      </td>
      <td className="p-3 text-right font-bold text-cyan-300">{prod.price.toFixed(2)} TL</td>
      <td className="p-3 text-center">
        <button
          onClick={() => onToggleFavorite(prod)}
          className={`p-1 rounded transition ${
            prod.isFavorite ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-600 hover:text-zinc-400'
          }`}
          title={prod.isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle"}
        >
          <Star className={`w-4 h-4 ${prod.isFavorite ? 'fill-amber-400' : ''}`} />
        </button>
      </td>
      <td className="p-3 text-center">
        <span
          className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
            prod.isStockControlled ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-500'
          }`}
        >
          {prod.isStockControlled ? 'Aktif' : 'Pasif'}
        </span>
      </td>
      <td className="p-3 text-center font-semibold text-zinc-300">
        {prod.isStockControlled ? `${prod.stockLevel} adet` : '-'}
      </td>
      <td className="p-3 text-center">
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => onEdit(prod)}
            className="hover:bg-amber-500/20 p-1 text-amber-400 rounded transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(prod)}
            className="hover:bg-rose-500/20 p-1 text-rose-400 rounded transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
