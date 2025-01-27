/*
 Navicat Premium Data Transfer

 Source Server         : EEEEE
 Source Server Type    : SQLite
 Source Server Version : 3030001
 Source Schema         : main

 Target Server Type    : SQLite
 Target Server Version : 3030001
 File Encoding         : 65001

 Date: 19/01/2025 11:58:47
*/

PRAGMA foreign_keys = false;

-- ----------------------------
-- Table structure for sound_buttons
-- ----------------------------
DROP TABLE IF EXISTS "sound_buttons";
CREATE TABLE "sound_buttons" (
  "button_name" TEXT NOT NULL,
  "category_id" INTEGER NOT NULL,
  "shortcut_key" TEXT,
  "shortcut_display" TEXT,
  "sound_path" TEXT,
  "button_index" INTEGER NOT NULL,
  FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- ----------------------------
-- Records of sound_buttons
-- ----------------------------
INSERT INTO "sound_buttons" VALUES ('众人笑声', 1, NULL, NULL, 'sounds/众人笑声.rack', 3);
INSERT INTO "sound_buttons" VALUES ('C哩C哩', 2, 50, 2, 'sounds/C哩C哩_1.rack', 0);
INSERT INTO "sound_buttons" VALUES ('爽朗笑声', 1, 'Y', NULL, 'sounds/爽朗笑声.rack', 16);
INSERT INTO "sound_buttons" VALUES ('多人笑声', 1, 112, 'F1', 'sounds/多人笑声.rack', 0);
INSERT INTO "sound_buttons" VALUES ('众人笑声2', 1, NULL, NULL, 'sounds/众人笑声2.rack', 5);
INSERT INTO "sound_buttons" VALUES ('小黄人笑2', 1, NULL, NULL, 'sounds/小黄人笑2.rack', 6);
INSERT INTO "sound_buttons" VALUES ('星爷笑声', 1, NULL, NULL, 'sounds/星爷笑声.rack', 7);
INSERT INTO "sound_buttons" VALUES ('欠揍笑声', 1, NULL, NULL, 'sounds/欠揍笑声.rack', 8);
INSERT INTO "sound_buttons" VALUES ('尖叫声', 1, NULL, NULL, 'sounds/尖叫声.rack', 9);
INSERT INTO "sound_buttons" VALUES ('轻微掌声', 1, NULL, NULL, 'sounds/轻微掌声.rack', 10);
INSERT INTO "sound_buttons" VALUES ('小黄人笑', 1, NULL, NULL, 'sounds/小黄人笑_1.rack', 11);
INSERT INTO "sound_buttons" VALUES ('欢呼掌声', 1, NULL, NULL, 'sounds/欢呼掌声.rack', 12);
INSERT INTO "sound_buttons" VALUES ('贼拉拉爱你', 1, NULL, NULL, 'sounds/贼拉拉爱你.rack', 13);
INSERT INTO "sound_buttons" VALUES ('乌鸦飞过', 1, NULL, NULL, 'sounds/乌鸦飞过.rack', 12);
INSERT INTO "sound_buttons" VALUES ('鄙视声', 1, NULL, NULL, 'sounds/鄙视声.rack', 13);
INSERT INTO "sound_buttons" VALUES ('机枪扫射', 1, NULL, NULL, 'sounds/机枪扫射.rack', 14);
INSERT INTO "sound_buttons" VALUES ('尴尬声', 1, NULL, NULL, 'sounds/尴尬声.rack', 15);
INSERT INTO "sound_buttons" VALUES ('尴尬声2', 1, 113, 'F2', 'sounds/尴尬声2.rack', 1);
INSERT INTO "sound_buttons" VALUES ('女人呻吟', 1, NULL, NULL, 'sounds/女人呻吟.rack', 17);
INSERT INTO "sound_buttons" VALUES ('快手笑声', 1, NULL, NULL, 'sounds/快手笑声.rack', 18);
INSERT INTO "sound_buttons" VALUES ('么么哒', 1, NULL, NULL, 'sounds/么么哒.rack', 19);
INSERT INTO "sound_buttons" VALUES ('可爱木嘛', 1, NULL, NULL, 'sounds/可爱木嘛.rack', 20);
INSERT INTO "sound_buttons" VALUES ('主持笑声', 1, NULL, NULL, 'sounds/主持笑声.rack', 21);
INSERT INTO "sound_buttons" VALUES ('放屁声', 1, NULL, NULL, 'sounds/放屁声.rack', 22);
INSERT INTO "sound_buttons" VALUES ('打耳光', 1, NULL, NULL, 'sounds/打耳光.rack', 23);
INSERT INTO "sound_buttons" VALUES ('牵手失败', 1, NULL, NULL, 'sounds/牵手失败.rack', 24);
INSERT INTO "sound_buttons" VALUES ('牵手成功', 1, NULL, NULL, 'sounds/牵手成功.rack', 25);
INSERT INTO "sound_buttons" VALUES ('灭灯声音', 1, NULL, NULL, 'sounds/灭灯声音.rack', 26);
INSERT INTO "sound_buttons" VALUES ('曾小贤笑声', 1, NULL, NULL, 'sounds/曾小贤笑声.rack', 27);
INSERT INTO "sound_buttons" VALUES ('男嘉宾出场', 1, NULL, NULL, 'sounds/男嘉宾出场.rack', 28);
INSERT INTO "sound_buttons" VALUES ('女嘉宾出场', 1, NULL, NULL, 'sounds/女嘉宾出场.rack', 29);
INSERT INTO "sound_buttons" VALUES ('坑礼物1', 1, NULL, NULL, 'sounds/坑礼物1.rack', 30);
INSERT INTO "sound_buttons" VALUES ('坑礼物2', 1, NULL, NULL, 'sounds/坑礼物2.rack', 31);
INSERT INTO "sound_buttons" VALUES ('坑礼物3', 1, NULL, NULL, 'sounds/坑礼物3.rack', 32);
INSERT INTO "sound_buttons" VALUES ('坑礼物4', 1, NULL, NULL, 'sounds/坑礼物4.rack', 33);
INSERT INTO "sound_buttons" VALUES ('坑礼物5', 1, NULL, NULL, 'sounds/坑礼物5.rack', 34);
INSERT INTO "sound_buttons" VALUES ('疑问？', 3, NULL, NULL, 'sounds/疑问？.rack', 0);
INSERT INTO "sound_buttons" VALUES ('综艺吃惊', 3, NULL, NULL, 'sounds/综艺吃惊.rack', 1);
INSERT INTO "sound_buttons" VALUES ('伊~妈了个X', 3, NULL, NULL, 'sounds/伊~妈了个X.rack', 2);
INSERT INTO "sound_buttons" VALUES ('皇上驾到', 3, NULL, NULL, 'sounds/皇上驾到.rack', 3);
INSERT INTO "sound_buttons" VALUES ('我勒个去', 3, NULL, NULL, 'sounds/我勒个去.rack', 4);
INSERT INTO "sound_buttons" VALUES ('小哪吒', 3, NULL, NULL, 'sounds/小哪吒.rack', 5);
INSERT INTO "sound_buttons" VALUES ('连环拳', 3, NULL, NULL, 'sounds/连环拳.rack', 6);
INSERT INTO "sound_buttons" VALUES ('警笛音效', 3, NULL, NULL, 'sounds/警笛音效.rack', 7);
INSERT INTO "sound_buttons" VALUES ('直升飞机', 3, NULL, NULL, 'sounds/直升飞机.rack', 8);
INSERT INTO "sound_buttons" VALUES ('搞笑狗叫', 3, NULL, NULL, 'sounds/搞笑狗叫.rack', 9);
INSERT INTO "sound_buttons" VALUES ('信了你的邪', 3, NULL, NULL, 'sounds/信了你的邪.rack', 10);
INSERT INTO "sound_buttons" VALUES ('幼儿园挑衅', 3, NULL, NULL, 'sounds/幼儿园挑衅.rack', 11);
INSERT INTO "sound_buttons" VALUES ('脱掉脱掉', 3, NULL, NULL, 'sounds/脱掉脱掉.rack', 12);
INSERT INTO "sound_buttons" VALUES ('尴尬声', 3, NULL, NULL, 'sounds/尴尬声_1.rack', 13);
INSERT INTO "sound_buttons" VALUES ('大悲咒', 3, NULL, NULL, 'sounds/大悲咒.rack', 14);
INSERT INTO "sound_buttons" VALUES ('狗屁声', 3, NULL, NULL, 'sounds/狗屁声.rack', 15);
INSERT INTO "sound_buttons" VALUES ('女人麦吻', 3, NULL, NULL, 'sounds/女人麦吻.rack', 16);
INSERT INTO "sound_buttons" VALUES ('笑喷声', 3, NULL, NULL, 'sounds/笑喷声.rack', 17);
INSERT INTO "sound_buttons" VALUES ('胜利狂笑', 3, NULL, NULL, 'sounds/胜利狂笑.rack', 18);
INSERT INTO "sound_buttons" VALUES ('婴儿大笑', 3, NULL, NULL, 'sounds/婴儿大笑.rack', 19);
INSERT INTO "sound_buttons" VALUES ('', 3, NULL, NULL, '', 20);
INSERT INTO "sound_buttons" VALUES ('', 3, NULL, NULL, '', 21);
INSERT INTO "sound_buttons" VALUES ('', 3, NULL, NULL, '', 22);
INSERT INTO "sound_buttons" VALUES ('', 3, NULL, NULL, '', 23);
INSERT INTO "sound_buttons" VALUES ('', 3, NULL, NULL, '', 24);
INSERT INTO "sound_buttons" VALUES (' 奥利给DJ', 1, NULL, NULL, 'sounds/ 奥利给DJ.rack', 35);
INSERT INTO "sound_buttons" VALUES ('（高跟鞋触地）', 1, NULL, NULL, 'sounds/（高跟鞋触地）_1.rack', 36);

PRAGMA foreign_keys = true;
