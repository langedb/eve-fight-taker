const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIAnalyzer {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Google API key is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
  }

  async analyzeCombat(currentStats, targetStats) {
    const prompt = this.buildCombatAnalysisPrompt(currentStats, targetStats);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysis = response.text();
      
      return this.parseAnalysisResponse(analysis);
    } catch (error) {
      console.error('AI analysis error:', error);
      return this.getFallbackAnalysis(currentStats, targetStats);
    }
  }

  buildCombatAnalysisPrompt(currentStats, targetStats) {
    return `
You are an expert EVE Online combat analyst. Analyze the following ship combat scenario and provide tactical recommendations.

CURRENT SHIP STATS:
- DPS: ${currentStats.dps.total} (EM: ${currentStats.dps.em}, Thermal: ${currentStats.dps.thermal}, Kinetic: ${currentStats.dps.kinetic}, Explosive: ${currentStats.dps.explosive})
- EHP: ${currentStats.ehp.total} (Hull: ${currentStats.ehp.hull}, Armor: ${currentStats.ehp.armor}, Shield: ${currentStats.ehp.shield})
- Speed: ${currentStats.speed} m/s
- Signature Radius: ${currentStats.signatureRadius} m
- Scan Resolution: ${currentStats.scanResolution} mm
- Lock Range: ${currentStats.lockRange} m
- Tank: ${currentStats.tank.total}/s (Hull: ${currentStats.tank.hull}, Armor: ${currentStats.tank.armor}, Shield: ${currentStats.tank.shield})

TARGET SHIP STATS:
- DPS: ${targetStats.dps.total} (EM: ${targetStats.dps.em}, Thermal: ${targetStats.dps.thermal}, Kinetic: ${targetStats.dps.kinetic}, Explosive: ${targetStats.dps.explosive})
- EHP: ${targetStats.ehp.total} (Hull: ${targetStats.ehp.hull}, Armor: ${targetStats.ehp.armor}, Shield: ${targetStats.ehp.shield})
- Speed: ${targetStats.speed} m/s
- Signature Radius: ${targetStats.signatureRadius} m
- Scan Resolution: ${targetStats.scanResolution} mm
- Lock Range: ${targetStats.lockRange} m
- Tank: ${targetStats.tank.total}/s (Hull: ${targetStats.tank.hull}, Armor: ${targetStats.tank.armor}, Shield: ${targetStats.tank.shield})

Based on EVE Online combat mechanics including:
- Signature radius and tracking affecting hit chance
- Damage application based on velocity and angular velocity
- Range and falloff mechanics
- Tank types and damage resistance profiles
- Lock time and scan resolution factors

Provide a tactical analysis in the following JSON format:
{
  "winChance": <percentage 0-100>,
  "timeToKill": <estimated seconds or "N/A">,
  "majorAdvantages": ["advantage1", "advantage2", ...],
  "majorDisadvantages": ["disadvantage1", "disadvantage2", ...],
  "tactics": {
    "range": "<optimal range strategy>",
    "movement": "<movement and positioning advice>",
    "engagement": "<how to engage the target>",
    "disengagement": "<when and how to disengage>"
  },
  "summary": "<2-3 sentence combat assessment>"
}

Be specific about EVE Online mechanics and provide actionable tactical advice.`;
  }

  parseAnalysisResponse(analysis) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback parsing if JSON isn't properly formatted
      return this.parseTextAnalysis(analysis);
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return this.parseTextAnalysis(analysis);
    }
  }

  parseTextAnalysis(analysis) {
    // Fallback text parsing for when JSON isn't returned
    const lines = analysis.split('\n').filter(line => line.trim());
    
    return {
      winChance: this.extractNumber(analysis, /win.*?(\d+)%/i) || 50,
      timeToKill: this.extractTimeToKill(analysis),
      majorAdvantages: this.extractListItems(analysis, /advantage|strength/i),
      majorDisadvantages: this.extractListItems(analysis, /disadvantage|weakness/i),
      tactics: {
        range: this.extractTactic(analysis, /range|distance/i),
        movement: this.extractTactic(analysis, /movement|maneuver|position/i),
        engagement: this.extractTactic(analysis, /engage|attack|approach/i),
        disengagement: this.extractTactic(analysis, /disengage|retreat|escape/i)
      },
      summary: this.extractSummary(analysis)
    };
  }

  extractNumber(text, regex) {
    const match = text.match(regex);
    return match ? parseInt(match[1]) : null;
  }

  extractTimeToKill(text) {
    const timeMatch = text.match(/(\d+)\s*(second|minute|sec|min)/i);
    if (timeMatch) {
      const value = parseInt(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      return unit.startsWith('min') ? value * 60 : value;
    }
    return "N/A";
  }

  extractListItems(text, categoryRegex) {
    const items = [];
    const lines = text.split('\n');
    
    let inCategory = false;
    for (const line of lines) {
      if (categoryRegex.test(line)) {
        inCategory = true;
        continue;
      }
      
      if (inCategory) {
        if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
          items.push(line.replace(/^[-•]\s*/, '').trim());
        } else if (line.trim() === '') {
          inCategory = false;
        }
      }
    }
    
    return items.slice(0, 3); // Limit to 3 items
  }

  extractTactic(text, categoryRegex) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (categoryRegex.test(lines[i])) {
        // Return next few lines as the tactic
        const tacticLines = [];
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          if (lines[j].trim() && !lines[j].includes(':')) {
            tacticLines.push(lines[j].trim());
          } else {
            break;
          }
        }
        return tacticLines.join(' ').substring(0, 200);
      }
    }
    return "Assess situation dynamically";
  }

  extractSummary(text) {
    // Try to find a summary section or use the first few meaningful sentences
    const summaryMatch = text.match(/summary[:\-\s]*(.*?)(?:\n\n|\n[A-Z]|$)/is);
    if (summaryMatch) {
      return summaryMatch[1].trim().substring(0, 300);
    }
    
    // Fallback to first paragraph
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 2).join('. ').trim().substring(0, 300);
  }

  getFallbackAnalysis(currentStats, targetStats) {
    // Basic fallback analysis when AI is unavailable
    const dpsRatio = currentStats.dps.total / (targetStats.dps.total || 1);
    const ehpRatio = currentStats.ehp.total / (targetStats.ehp.total || 1);
    const speedRatio = currentStats.speed / (targetStats.speed || 1);
    
    const winChance = Math.max(10, Math.min(90, 
      (dpsRatio * 40) + (ehpRatio * 30) + (speedRatio * 20) + 10
    ));
    
    const timeToKill = targetStats.ehp.total / (currentStats.dps.total || 1);
    
    return {
      winChance: Math.round(winChance),
      timeToKill: Math.round(timeToKill),
      majorAdvantages: dpsRatio > 1.2 ? ["Higher DPS"] : speedRatio > 1.2 ? ["Speed advantage"] : ["Balanced engagement"],
      majorDisadvantages: dpsRatio < 0.8 ? ["Lower DPS"] : ehpRatio < 0.8 ? ["Lower EHP"] : ["Fairly matched"],
      tactics: {
        range: "Maintain optimal range for your weapon systems",
        movement: speedRatio > 1.2 ? "Use speed advantage to control engagement" : "Focus on tracking and positioning",
        engagement: dpsRatio > 1.2 ? "Engage aggressively" : "Engage cautiously, look for tactical advantage",
        disengagement: "Disengage if taking heavy damage without dealing significant damage in return"
      },
      summary: `Combat analysis shows ${winChance}% estimated win chance. Focus on leveraging your ${dpsRatio > 1.2 ? 'DPS' : speedRatio > 1.2 ? 'speed' : 'positioning'} advantage.`
    };
  }
}

module.exports = { AIAnalyzer };