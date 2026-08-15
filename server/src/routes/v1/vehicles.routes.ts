import { Router, Request, Response } from 'express';
import { query } from '../../config/db';

const router = Router();

/**
 * GET /api/v1/vehicles/makes-models
 * Description: Fetches all registered Pakistani automobile makes and their associated models.
 * Authentication: Public / Client accessible.
 * Response: 200 OK with makes list containing models array.
 */
router.get('/makes-models', async (_req: Request, res: Response) => {
  try {
    const makesResult = await query('SELECT * FROM vehicle_makes ORDER BY name ASC');
    const modelsResult = await query('SELECT * FROM vehicle_models ORDER BY name ASC');

    if (makesResult.rows.length === 0) {
      // Fallback response with core Pakistani brand data
      return res.status(200).json({
        makes: [
          { name: 'Suzuki', models: ['Alto', 'Cultus', 'Wagon R', 'Swift', 'Bolan', 'Mehran', 'Every', 'Ciaz'] },
          { name: 'Toyota', models: ['Corolla', 'Yaris', 'Vitz', 'Passo', 'Fortuner', 'Hilux Revo', 'Prius', 'Aqua'] },
          { name: 'Honda', models: ['Civic', 'City', 'BR-V', 'HR-V', 'Vezel', 'N-One', 'N-Wgn'] },
          { name: 'Hyundai', models: ['Elantra', 'Tucson', 'Sonata', 'Grand Starex', 'Porter H-100'] },
          { name: 'Kia', models: ['Sportage', 'Picanto', 'Stonic', 'Sorento', 'Carnival'] },
          { name: 'Changan', models: ['Alsvin', 'Karvaan', 'Oshan X7', 'M9'] },
          { name: 'MG', models: ['HS', 'ZS', 'ZS EV', 'GT'] },
          { name: 'DFSK', models: ['Glory 580', 'K01'] },
          { name: 'Prince', models: ['Pearl', 'K07'] },
          { name: 'FAW', models: ['V2', 'X-PV', 'Carrier'] },
          { name: 'Isuzu', models: ['D-Max'] },
          { name: 'JAC', models: ['X200', 'T6'] },
          { name: 'Proton', models: ['Saga', 'X70'] },
          { name: 'Audi', models: ['A3', 'A4', 'A6', 'Q3', 'Q5'] },
          { name: 'BMW', models: ['3 Series', '5 Series', 'X1', 'X3'] },
          { name: 'Mercedes', models: ['C-Class', 'E-Class', 'GLA'] },
          { name: 'Nissan', models: ['Dayz', 'Clipper', 'Sunny', 'Note'] },
          { name: 'Mitsubishi', models: ['Ek Wagon', 'Mirage', 'Lancer', 'Pajero'] },
          { name: 'Others', models: ['Custom Model / Bike / Scooty'] },
        ],
      });
    }

    const makesMap: Record<number, { name: string; models: string[] }> = {};
    makesResult.rows.forEach((row: any) => {
      makesMap[row.id] = { name: row.name, models: [] };
    });

    modelsResult.rows.forEach((row: any) => {
      if (makesMap[row.make_id]) {
        makesMap[row.make_id].models.push(row.name);
      }
    });

    const makesList = Object.values(makesMap);

    res.status(200).json({ makes: makesList });
  } catch (error) {
    console.error('Error fetching vehicle makes/models:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle catalog' });
  }
});

export default router;
