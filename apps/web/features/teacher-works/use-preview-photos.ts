"use client";
import { useEffect, useRef, useState } from 'react';
import { solutionPhotoPolicy, type SolutionAnswer } from '@continuum/shared';

export function usePreviewPhotos() {
  const [photos, setPhotos] = useState<Record<string, SolutionAnswer['photos']>>({});
  const live = useRef(photos);
  const urls = useRef(new Set<string>());
  useEffect(() => () => { for (const url of urls.current) URL.revokeObjectURL(url); urls.current.clear(); }, []);
  function update(taskId: string, value: SolutionAnswer['photos']) { live.current = { ...live.current, [taskId]: value }; setPhotos(live.current); }
  return {
    photos,
    add(taskId: string, files: File[]): string | null {
      if (!files.length) return null;
      if (files.some((file) => !solutionPhotoPolicy.contentTypes.some((type) => type === file.type))) return 'Выберите фотографии в формате JPG, PNG или WebP.';
      if (files.some((file) => !file.size || file.size > solutionPhotoPolicy.maxBytes)) return 'Каждая фотография должна быть не больше 10 МБ.';
      const current = live.current[taskId] ?? [];
      if (current.length + files.length > solutionPhotoPolicy.maxPhotos) return 'Можно добавить не более 10 фотографий к задаче.';
      update(taskId, [...current, ...files.map((file) => {
        const url = URL.createObjectURL(file); urls.current.add(url);
        return { id: crypto.randomUUID(), url, sizeBytes: file.size, contentType: solutionPhotoPolicy.contentTypes.find((type) => type === file.type)!, createdAt: new Date().toISOString() };
      })]);
      return null;
    },
    remove(taskId: string, id: string) {
      const current = live.current[taskId] ?? [], photo = current.find((item) => item.id === id);
      if (photo) { URL.revokeObjectURL(photo.url); urls.current.delete(photo.url); }
      update(taskId, current.filter((item) => item.id !== id));
    },
  };
}
