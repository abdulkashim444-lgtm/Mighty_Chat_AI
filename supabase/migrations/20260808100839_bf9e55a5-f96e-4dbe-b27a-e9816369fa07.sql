CREATE POLICY "Users update own chat files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-uploads'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'chat-uploads'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);