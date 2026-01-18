import { google } from 'googleapis';
import { getOAuthClient } from './googleAuthService.js';
import { supabase } from '../../lib/supabaseClient.js';
import fs from 'fs';
import path from 'path';

// Lista arquivos no Google Drive
export const listFiles = async (userId, organizationId, folderId = null) => {
  try {
    console.log('📁 Listando arquivos do Google Drive...');
    const oAuth2Client = await getOAuthClient(userId, organizationId, 'drive');
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    let query = 'trashed = false';
    if (folderId) {
      query += ` and '${folderId}' in parents`;
    }

    const res = await drive.files.list({
      q: query,
      pageSize: 50,
      fields: 'files(id, name, mimeType, modifiedTime, size, parents)',
      orderBy: 'modifiedTime desc'
    });

    console.log(`✅ ${res.data.files.length} arquivos encontrados`);
    return res.data.files;
  } catch (error) {
    console.error('❌ Erro ao listar arquivos do Drive:', error.message);
    throw new Error('Erro ao listar arquivos do Drive');
  }
};

// Verifica se uma pasta existe
export const checkIfFolderExists = async (drive, folderName) => {
  try {
    const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;

    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const folders = res.data.files;

    if (folders.length > 0) {
      console.log(`✅ Pasta encontrada: ${folders[0].name} (ID: ${folders[0].id})`);
      return folders[0];
    } else {
      console.log('❌ Pasta não encontrada');
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao verificar pasta:', error);
    throw error;
  }
};

// Faz upload de um arquivo
export const uploadFile = async (userId, organizationId, fileName, mimeType, fileStream, folderId = null) => {
  try {
    console.log('📤 Fazendo upload para o Google Drive...');
    const oAuth2Client = await getOAuthClient(userId, organizationId, 'drive');
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    // Verificar se a pasta da organização existe
    const existingFolder = await checkIfFolderExists(drive, organizationId);
    if (existingFolder) {
      folderId = existingFolder.id;
    }

    const fileMetadata = {
      name: fileName,
      ...(folderId && { parents: [folderId] })
    };

    const media = {
      mimeType,
      body: fileStream,
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, name, mimeType, size, parents',
    });

    console.log('✅ Arquivo enviado com sucesso:', file.data.name);
    return file.data;
  } catch (error) {
    console.error('❌ Erro ao fazer upload para o Drive:', error.message);
    throw new Error('Erro ao fazer upload para o Drive');
  }
};

// Cria pasta para a organização
export const createFolderForOrganization = async (userId, organizationId) => {
  try {
    console.log('📁 Criando pasta para organização...');
    const oAuth2Client = await getOAuthClient(userId, organizationId, 'drive');
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    const folderMetadata = {
      name: organizationId.toString(),
      mimeType: 'application/vnd.google-apps.folder',
    };

    const file = await drive.files.create({
      resource: folderMetadata,
      fields: 'id, name',
    });
    
    console.log('✅ Pasta criada:', file.data.name, '| ID:', file.data.id);
    return file.data.id;
  } catch (error) {
    console.error('❌ Erro ao criar a pasta:', error.message);
    throw error;
  }
};

// Deleta arquivo
export const deleteFile = async (userId, organizationId, fileId) => {
  try {
    console.log('🗑️ Deletando arquivo do Google Drive...');
    const oAuth2Client = await getOAuthClient(userId, organizationId, 'drive');
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    await drive.files.delete({ fileId });

    // Remover do banco de dados
    const { error } = await supabase
      .from('google_drive_files')
      .delete()
      .eq('google_file_id', fileId);

    if (error) {
      console.warn('⚠️ Erro ao remover arquivo do banco:', error);
    }

    console.log('✅ Arquivo deletado com sucesso');
    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao deletar arquivo do Drive:', error.message);
    throw new Error('Erro ao deletar arquivo do Drive');
  }
};

// Baixa arquivo
export const downloadFile = async (userId, organizationId, fileId, destinationPath) => {
  try {
    console.log('📥 Baixando arquivo do Google Drive...');
    const oAuth2Client = await getOAuthClient(userId, organizationId, 'drive');
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    const res = await drive.files.get({
      fileId,
      alt: 'media',
    }, { responseType: 'stream' });

    const writeStream = fs.createWriteStream(destinationPath);
    
    await new Promise((resolve, reject) => {
      res.data
        .on('end', () => {
          console.log('✅ Arquivo baixado com sucesso');
          resolve();
        })
        .on('error', err => {
          console.error('❌ Erro ao baixar arquivo:', err);
          reject(err);
        })
        .pipe(writeStream);
    });

    return { success: true, path: destinationPath };
  } catch (error) {
    console.error('❌ Erro ao baixar arquivo do Drive:', error.message);
    throw new Error('Erro ao baixar arquivo do Drive');
  }
};

// Salva referência do arquivo no banco
export const saveFileReference = async (userId, organizationId, googleFileId, fileName, mimeType, fileSize, folderId = null, chatId = null, messageId = null) => {
  try {
    console.log('💾 Salvando referência do arquivo no banco...');
    
    const { data, error } = await supabase
      .from('google_drive_files')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        google_file_id: googleFileId,
        file_name: fileName,
        mime_type: mimeType,
        file_size: fileSize,
        folder_id: folderId,
        chat_id: chatId,
        message_id: messageId
      })
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ Referência do arquivo salva:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Erro ao salvar referência do arquivo:', error);
    throw error;
  }
};

// Upload de arquivo local para o Drive
export const uploadLocalFile = async (userId, organizationId, localFilePath, fileName = null, chatId = null, messageId = null) => {
  try {
    console.log('📤 Fazendo upload de arquivo local...');
    
    if (!fs.existsSync(localFilePath)) {
      throw new Error('Arquivo local não encontrado');
    }

    const stats = fs.statSync(localFilePath);
    const fileStream = fs.createReadStream(localFilePath);
    const finalFileName = fileName || path.basename(localFilePath);
    const mimeType = getMimeType(path.extname(localFilePath));

    // Fazer upload para o Drive
    const driveFile = await uploadFile(userId, organizationId, finalFileName, mimeType, fileStream);
    
    // Salvar referência no banco
    await saveFileReference(
      userId, 
      organizationId, 
      driveFile.id, 
      finalFileName, 
      mimeType, 
      stats.size,
      null,
      chatId,
      messageId
    );

    return driveFile;
  } catch (error) {
    console.error('❌ Erro ao fazer upload de arquivo local:', error);
    throw error;
  }
};

// Função auxiliar para determinar MIME type
const getMimeType = (extension) => {
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed'
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
};

// Lista arquivos do banco de dados
export const listStoredFiles = async (userId, organizationId, chatId = null) => {
  try {
    console.log('📋 Listando arquivos armazenados...');
    
    let query = supabase
      .from('google_drive_files')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (chatId) {
      query = query.eq('chat_id', chatId);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    console.log(`✅ ${data.length} arquivos encontrados no banco`);
    return data;
  } catch (error) {
    console.error('❌ Erro ao listar arquivos armazenados:', error);
    throw error;
  }
};
