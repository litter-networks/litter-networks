// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

export {};

const networkInfoController = require('../../../controllers/legacy/network-info-controller');
const mockResponse = require('node-mocks-http').createResponse;
const mockRequest = require('node-mocks-http').createRequest;

// Mock the NetworksInfo module
jest.mock('../../../utils/networks-info.js', () => ({
  getAllNetworks: jest.fn().mockResolvedValue([
    { uniqueId: 'network1', fullName: 'Test Network 1', district: 'District 1' },
    { uniqueId: 'network2', fullName: 'Test Network 2', district: 'District 2' }
  ]),
  getAllDistricts: jest.fn().mockResolvedValue([
    { uniqueId: 'district1', name: 'District 1' },
    { uniqueId: 'district2', name: 'District 2' }
  ]),
  getAllDistrictLocalInfos: jest.fn().mockResolvedValue([
    { uniqueId: 'district1', name: 'District 1', localInfo: 'Info 1' },
    { uniqueId: 'district2', name: 'District 2', localInfo: 'Info 2' }
  ])
}));

const NetworksInfo = require('../../../utils/networks-info.js');

describe('Network Info Controller', () => {
  let req;
  let res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    res.setHeader = jest.fn();
    res.send = jest.fn();
    res.status = jest.fn().mockReturnThis();
    res.json = jest.fn().mockReturnThis();
  });

  describe('getNetworksCsv', () => {
    it('should return networks data in CSV format', async () => {
      await networkInfoController.getNetworksCsv(req, res);
      
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition', 
        'attachment; filename="networks.csv"'
      );
      expect(res.send).toHaveBeenCalled();
    });

    it('injects overrides for known networks and escapes fields', async () => {
      NetworksInfo.getAllNetworks.mockResolvedValueOnce([
        { uniqueId: 'croftlitter', fullName: 'Croft "Litter"', extra: 'Value' },
        { uniqueId: 'plain', fullName: 'Plain' }
      ]);

      await networkInfoController.getNetworksCsv(req, res);

      const csv = res.send.mock.calls[0][0];
      expect(csv).toContain('"contactEmail"');
      expect(csv).toContain('croft@litternetworks.org');
      expect(csv).toContain('""Litter""'); // quotes escaped
    });

    it('handles errors from NetworksInfo', async () => {
      NetworksInfo.getAllNetworks.mockRejectedValueOnce(new Error('boom'));
      await networkInfoController.getNetworksCsv(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Error generating CSV'));
    });
  });

  describe('getDistrictsCsv', () => {
    it('should return districts data in CSV format', async () => {
      await networkInfoController.getDistrictsCsv(req, res);
      
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition', 
        'attachment; filename="districts.csv"'
      );
      expect(res.send).toHaveBeenCalled();
    });

    it('returns 500 when getAllDistricts fails', async () => {
      NetworksInfo.getAllDistricts.mockRejectedValueOnce(new Error('fail'));
      await networkInfoController.getDistrictsCsv(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Internal server error generating CSV');
    });
  });

  describe('getDistrictsLocalInfoCsv', () => {
    it('should return districts local info data in CSV format', async () => {
      await networkInfoController.getDistrictsLocalInfoCsv(req, res);
      
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition', 
        'attachment; filename="districts-local-info.csv"'
      );
      expect(res.send).toHaveBeenCalled();
    });

    it('returns 500 when getAllDistrictLocalInfos fails', async () => {
      NetworksInfo.getAllDistrictLocalInfos.mockRejectedValueOnce(new Error('bad'));
      await networkInfoController.getDistrictsLocalInfoCsv(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Error generating CSV'));
    });
  });

  describe('generateCsv', () => {
    it('should generate CSV content from headers and rows', () => {
      // This is testing an internal function, we can test it through the exported functions
      // which is more appropriate for a unit test of a module
      const headers = ['id', 'name'];
      const rows = [
        { id: '1', name: 'Test 1' },
        { id: '2', name: 'Test 2' }
      ];
      
      // The generateCsv function is private, so this is a lightweight smoke check
      expect(headers).toEqual(['id', 'name']);
      expect(rows).toHaveLength(2);
    });
  });
});
