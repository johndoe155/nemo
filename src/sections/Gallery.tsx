import CircularGallery, { type GalleryBadge } from '../components/CircularGallery';
import { ARTISTS, GALLERY_PLATES, UNIVERSES } from '../lib/data';

/* ---------------------------------------------------------------------------
   02 · THE ROTUNDA
   The 3D rotunda sits directly after the Nemoverse roster: the roster is the
   sortable registry (specs, supply, price), this is the same canon hung as a
   room you can walk around. All copy is passed in as props — the component
   itself owns no strings — and the badge counts are derived from the data
   layer so they can never drift from the registry.
--------------------------------------------------------------------------- */

const ROTUNDA_BADGES: GalleryBadge[] = [
  { label: 'PLATES IN ROTATION', count: GALLERY_PLATES.length, accent: '#3fe8ff' },
  { label: 'REGISTERED UNIVERSES', count: UNIVERSES.length, accent: '#8a4dff' },
  { label: 'CANON ARTISTS', count: ARTISTS.length, accent: '#ffc857' },
];

export default function Gallery() {
  return (
    <CircularGallery
      id="rotunda"
      items={GALLERY_PLATES}
      eyebrow="02 · THE ROTUNDA"
      title="Drift through the canon"
      subtitle="Every commissioned universe, hung in one rotating hall — from the prime reality to the signal that was never commissioned. Drag the ring, swipe it, or walk it with the arrow keys."
      badges={ROTUNDA_BADGES}
      bend={0.5}
      borderRadius={14}
      hint="Drag · swipe · ← → to rotate"
    />
  );
}
