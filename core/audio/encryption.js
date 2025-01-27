const fs = require('fs').promises;
const path = require('path');

// 加密/解密用的魔数标记
const MAGIC_BYTES = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]);
const CHUNK_SIZE = 1024; // 分片大小

class AudioEncryption {
    // 加密音频文件
    static async encryptAudio(sourcePath, targetPath) {
        try {
            // 读取源文件
            const fileData = await fs.readFile(sourcePath);
            
            // 分片并加密
            const chunks = [];
            for (let i = 0; i < fileData.length; i += CHUNK_SIZE) {
                const chunk = fileData.slice(i, i + CHUNK_SIZE);
                // 对每个分片进行简单的位反转加密
                for (let j = 0; j < chunk.length; j++) {
                    chunk[j] = chunk[j] ^ 0xFF;
                }
                chunks.push(chunk);
            }

            // 添加魔数标记并合并所有分片
            const encryptedData = Buffer.concat([
                MAGIC_BYTES,
                ...chunks
            ]);

            // 写入加密后的文件
            await fs.writeFile(targetPath, encryptedData);
            return true;
            
        } catch (err) {
            console.error('加密音频失败:', err);
            throw err;
        }
    }

    // 解密音频文件
    static async decryptAudio(filePath) {
        try {
            // 读取加密的文件
            const fileData = await fs.readFile(filePath);
            
            // 验证魔数
            const magicBytes = fileData.slice(0, 4);
            if (!magicBytes.equals(MAGIC_BYTES)) {
                throw new Error('无效的文件格式');
            }

            // 解密文件内容
            const content = fileData.slice(4); // 跳过魔数
            const decrypted = Buffer.alloc(content.length);
            
            // 解密每个字节
            for (let i = 0; i < content.length; i++) {
                decrypted[i] = content[i] ^ 0xFF; // 位反转解密
            }

            return decrypted;
            
        } catch (err) {
            console.error('解密音频失败:', err);
            throw err;
        }
    }

    // 获取音频数据(用于播放)
    static async getAudioData(relativePath) {
        try {
            // 移除可能的 sounds 前缀
            const fileName = relativePath.replace(/^sounds[/\\]+/, '');
            
            // 构建完整路径
            const fullPath = path.join(process.cwd(), 'sounds', fileName);
            
            console.log('读取音频文件:', fullPath);
            
            // 解密文件
            const decryptedData = await this.decryptAudio(fullPath);
            
            // 返回 Base64 编码的数据
            return decryptedData.toString('base64');
            
        } catch (err) {
            console.error('获取音频数据失败:', err);
            throw err;
        }
    }
}

module.exports = AudioEncryption; 